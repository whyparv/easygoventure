import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { NotFoundException, ValidationException } from '../../common/exceptions/app.exceptions';
import { requireOrganizationId, tenantFilter } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { ProposalDocument } from '../proposals/schemas/proposal.schema';
import { BookingsService } from './bookings.service';
import { TravelersService } from './travelers.service';
import { TravelTimelineService } from './travel-timeline.service';
import { GeneratedDocumentsRepository } from './generated-documents.repository';
import {
  DocumentType,
  GeneratedDocument,
  GeneratedDocumentDocument,
} from './schemas/generated-document.schema';
import { BookingDocument } from './schemas/booking.schema';
import { TravelerDocument } from './schemas/traveler.schema';
import { GenerateDocumentDto } from './dto/booking-details.dto';

export interface DocumentGenerationResult {
  document: GeneratedDocumentDocument;
  content: Record<string, unknown>;
}

const TITLES: Record<DocumentType, string> = {
  [DocumentType.TRAVEL_VOUCHER]: 'Travel Voucher',
  [DocumentType.FINAL_ITINERARY]: 'Final Itinerary',
  [DocumentType.TRAVELER_MANIFEST]: 'Traveler Manifest',
  [DocumentType.BOOKING_SUMMARY]: 'Booking Summary',
  [DocumentType.OPERATIONAL_BRIEF]: 'Operational Brief',
};

/**
 * DocumentGenerationService — assembles travel documents from the proposal
 * snapshot + traveler + booking data. The BINARY IS NEVER STORED in MongoDB; we
 * persist metadata only (provenance + a content checksum + an optional external
 * storage pointer) and return the assembled content for rendering downstream.
 */
@Injectable()
export class DocumentGenerationService {
  constructor(
    private readonly proposals: ProposalsRepository,
    private readonly travelers: TravelersService,
    private readonly bookings: BookingsService,
    private readonly timeline: TravelTimelineService,
    private readonly documents: GeneratedDocumentsRepository,
    private readonly audit: AuditService,
  ) {}

  async generate(
    proposalId: string,
    type: DocumentType,
    dto: GenerateDocumentDto,
    user: AuthenticatedUser,
  ): Promise<DocumentGenerationResult> {
    const proposal = await this.ensureProposal(proposalId, user);
    const [travelerList, bookingList] = await Promise.all([
      this.travelers.list(proposalId, user),
      this.bookings.list(proposalId, user),
    ]);

    const content = await this.assemble(type, proposal, travelerList, bookingList, user);
    const checksum = createHash('sha256').update(JSON.stringify(content)).digest('hex');
    const title = `${TITLES[type]} — ${proposal.title}`;

    const record = await this.documents.create({
      organizationId: requireOrganizationId(user),
      proposalId: new Types.ObjectId(proposal.id as string),
      type,
      title,
      format: dto.format ?? 'application/json',
      checksum,
      storageRef: dto.storageRef,
      generatedBy: user.id ? new Types.ObjectId(user.id) : null,
      metadata: {
        travelerCount: travelerList.length,
        bookingCount: bookingList.length,
        proposalToken: proposal.generatedToken,
      },
    } satisfies Partial<GeneratedDocument>);

    await this.audit.recordForActor(user, undefined, {
      action: 'document.generated',
      entity: 'GeneratedDocument',
      entityId: record.id as string,
      metadata: { proposalId, type },
    });

    return { document: record, content };
  }

  list(proposalId: string, user: AuthenticatedUser): Promise<GeneratedDocumentDocument[]> {
    if (!Types.ObjectId.isValid(proposalId)) {
      throw new ValidationException(`"${proposalId}" is not a valid id`, 'INVALID_ID');
    }
    return this.documents.findByProposal(tenantFilter(user), new Types.ObjectId(proposalId));
  }

  // ── Content assembly ───────────────────────────────────────────────────────

  private async assemble(
    type: DocumentType,
    proposal: ProposalDocument,
    travelers: TravelerDocument[],
    bookings: BookingDocument[],
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown>> {
    const header = {
      proposalId: proposal.id as string,
      reference: proposal.generatedToken,
      title: proposal.title,
      currency: proposal.currency,
      acceptedPrice: proposal.acceptedPrice ?? proposal.amount,
    };

    switch (type) {
      case DocumentType.TRAVELER_MANIFEST:
        return { ...header, travelers: travelers.map((t) => this.traveler(t)) };

      case DocumentType.BOOKING_SUMMARY:
        return { ...header, bookings: bookings.map((b) => this.booking(b)) };

      case DocumentType.FINAL_ITINERARY: {
        const timeline = await this.timeline.forProposal(proposal.id as string, user);
        return { ...header, travelerCount: travelers.length, itinerary: timeline.events };
      }

      case DocumentType.TRAVEL_VOUCHER:
        return {
          ...header,
          travelers: travelers.map((t) => `${t.firstName} ${t.lastName}`),
          confirmedServices: bookings
            .filter((b) => b.bookingReference || b.supplierReference)
            .map((b) => this.booking(b)),
        };

      case DocumentType.OPERATIONAL_BRIEF: {
        const timeline = await this.timeline.forProposal(proposal.id as string, user);
        return {
          ...header,
          bookingStatus: proposal.bookingStatus,
          travelers: travelers.map((t) => this.traveler(t)),
          bookings: bookings.map((b) => this.booking(b)),
          timeline: { start: timeline.start, end: timeline.end, events: timeline.events },
        };
      }

      default:
        throw new ValidationException(
          `Unsupported document type "${String(type)}"`,
          'UNSUPPORTED_DOCUMENT_TYPE',
        );
    }
  }

  private traveler(t: TravelerDocument): Record<string, unknown> {
    return {
      name: `${t.firstName} ${t.lastName}`,
      nationality: t.nationality ?? null,
      passportNumber: t.passportNumber ?? null,
      passportExpiry: t.passportExpiry ?? null,
      status: t.status,
    };
  }

  private booking(b: BookingDocument): Record<string, unknown> {
    return {
      id: b.id as string,
      type: b.bookingType,
      status: b.status,
      bookingReference: b.bookingReference ?? null,
      supplierReference: b.supplierReference ?? null,
      travelDate: b.travelDate ?? null,
      hotelDetails: b.hotelDetails ?? null,
      transferDetails: b.transferDetails ?? null,
      visaProcessing: b.visaProcessing ?? null,
    };
  }

  private async ensureProposal(
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalDocument> {
    if (!Types.ObjectId.isValid(proposalId)) {
      throw new ValidationException(`"${proposalId}" is not a valid id`, 'INVALID_ID');
    }
    const proposal = await this.proposals.findById(proposalId, tenantFilter(user));
    if (!proposal) throw new NotFoundException(`Proposal "${proposalId}" not found`, 'PROPOSAL_NOT_FOUND');
    return proposal;
  }
}
