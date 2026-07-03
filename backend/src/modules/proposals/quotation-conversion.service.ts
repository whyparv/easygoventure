import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { BusinessException } from '../../common/exceptions/app.exceptions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { QuotationsService } from '../quotations/quotations.service';
import { QuotationStatus } from '../quotations/schemas/quotation.schema';
import { PackagesService } from '../packages/packages.service';
import { InquiriesService } from '../inquiries/inquiries.service';
import { ProposalsRepository } from './proposals.repository';
import { ProposalTokenService } from './proposal-token.service';
import {
  Proposal,
  ProposalBookingStatus,
  ProposalDocument,
  ProposalStatus,
  ProposalType,
} from './schemas/proposal.schema';

const MAX_TOKEN_ATTEMPTS = 5;

/**
 * QuotationConversionService — turns an ACCEPTED quotation into an executable
 * proposal, copying the frozen commercial snapshot (NOT the live package) so the
 * accepted commercial terms are contractual and survive later vendor/rate/package
 * changes. Single-use: a quotation can convert exactly once.
 */
@Injectable()
export class QuotationConversionService {
  constructor(
    private readonly quotations: QuotationsService,
    private readonly packages: PackagesService,
    private readonly inquiries: InquiriesService,
    private readonly proposals: ProposalsRepository,
    private readonly tokens: ProposalTokenService,
    private readonly audit: AuditService,
  ) {}

  async convertAcceptedQuotation(
    quotationId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalDocument> {
    const quotation = await this.quotations.findByIdOrThrow(quotationId, user);
    if (quotation.status !== QuotationStatus.ACCEPTED) {
      throw new BusinessException(
        `Only an ACCEPTED quotation can be converted (is ${quotation.status})`,
        'QUOTATION_NOT_ACCEPTED',
      );
    }
    if (quotation.convertedProposalId) {
      throw new BusinessException(
        'This quotation has already been converted to a proposal',
        'ALREADY_CONVERTED',
      );
    }

    const { inquiryId, leadId } = await this.resolveLineage(quotation.packageId.toString(), user);

    const base: Partial<Proposal> = {
      organizationId: new Types.ObjectId(user.organizationId as string),
      leadId,
      inquiryId,
      packageId: quotation.packageId,
      quotationId: new Types.ObjectId(quotation.id as string),
      quotationNumber: quotation.quotationNumber,
      quotationVersion: quotation.version,
      title: `Proposal for ${quotation.snapshot.name} (${quotation.quotationNumber})`,
      proposalType: ProposalType.TRAVEL_PACKAGE,
      amount: quotation.customerPrice,
      currency: quotation.currency,
      // Frozen commercial terms copied from the accepted quotation snapshot.
      commercialSnapshot: quotation.snapshot,
      acceptedPrice: quotation.customerPrice,
      acceptedDate: quotation.acceptedAt,
      status: ProposalStatus.ACCEPTED,
      bookingStatus: ProposalBookingStatus.NOT_READY,
    };

    const proposal = await this.createWithUniqueToken(base);
    await this.quotations.markConverted(quotationId, proposal.id as string, user);

    await this.audit.recordForActor(user, undefined, {
      action: 'quotation.converted',
      entity: 'Quotation',
      entityId: quotationId,
      newValue: { proposalId: proposal.id as string, quotationNumber: quotation.quotationNumber },
    });
    await this.audit.recordForActor(user, undefined, {
      action: 'proposal.created',
      entity: 'Proposal',
      entityId: proposal.id as string,
      metadata: { source: 'quotation', quotationId },
      newValue: { acceptedPrice: proposal.acceptedPrice, token: proposal.generatedToken },
    });
    return proposal;
  }

  /**
   * Resolve the sales chain: package → inquiry → converted lead. Best-effort — a
   * commercial proposal is valid even if the inquiry was never converted to a lead.
   */
  private async resolveLineage(
    packageId: string,
    user: AuthenticatedUser,
  ): Promise<{ inquiryId: Types.ObjectId | null; leadId: Types.ObjectId | null }> {
    try {
      const pkg = await this.packages.findByIdOrThrow(packageId, user);
      if (!pkg.inquiryId) return { inquiryId: null, leadId: null };
      const inquiryId = pkg.inquiryId;
      try {
        const inquiry = await this.inquiries.findByIdOrThrow(inquiryId.toString(), user);
        return { inquiryId, leadId: inquiry.convertedLeadId ?? null };
      } catch {
        return { inquiryId, leadId: null };
      }
    } catch {
      return { inquiryId: null, leadId: null };
    }
  }

  private async createWithUniqueToken(base: Partial<Proposal>): Promise<ProposalDocument> {
    for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt += 1) {
      try {
        return await this.proposals.create({ ...base, generatedToken: this.tokens.generate() });
      } catch (error) {
        if (this.isDuplicateKeyError(error) && attempt < MAX_TOKEN_ATTEMPTS - 1) continue;
        throw error;
      }
    }
    throw new BusinessException('Could not allocate a unique proposal token', 'TOKEN_ALLOCATION');
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }
}
