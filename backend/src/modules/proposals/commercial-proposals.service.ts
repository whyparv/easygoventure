import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { ProposalsRepository } from './proposals.repository';
import { FulfillmentItemsRepository } from './fulfillment-items.repository';
import { BookingReadinessService, ReadinessResult } from './booking-readiness.service';
import { ProposalBookingStatus, ProposalDocument } from './schemas/proposal.schema';
import {
  FulfillmentItem,
  FulfillmentItemDocument,
  FulfillmentItemStatus,
  ServiceLineType,
} from './schemas/fulfillment-item.schema';
import { UpdateFulfillmentItemDto } from './dto/commercial-proposal.dto';

export interface ProposalLineage {
  leadId: string | null;
  inquiryId: string | null;
  packageId: string | null;
  quotationId: string | null;
  quotationNumber: string | null;
  quotationVersion: number | null;
  proposalId: string;
}

@Injectable()
export class CommercialProposalsService {
  constructor(
    private readonly proposals: ProposalsRepository,
    private readonly items: FulfillmentItemsRepository,
    private readonly readiness: BookingReadinessService,
    private readonly audit: AuditService,
  ) {}

  async getProposalOrThrow(id: string, user: AuthenticatedUser): Promise<ProposalDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const proposal = await this.proposals.findById(id, this.scope(user));
    if (!proposal) throw new NotFoundException(`Proposal "${id}" not found`, 'PROPOSAL_NOT_FOUND');
    return proposal;
  }

  /** Read-only readiness evaluation (no status change) — used by AI context. */
  async evaluateReadiness(id: string, user: AuthenticatedUser): Promise<ReadinessResult> {
    const proposal = await this.getProposalOrThrow(id, user);
    return this.readiness.validate(proposal);
  }

  /** Validate booking readiness; advance NOT_READY → READY_FOR_BOOKING when ready. */
  async checkReadiness(id: string, user: AuthenticatedUser): Promise<ReadinessResult> {
    const proposal = await this.getProposalOrThrow(id, user);
    const result = this.readiness.validate(proposal);
    if (result.ready && proposal.bookingStatus === ProposalBookingStatus.NOT_READY) {
      await this.proposals.update(
        id,
        { bookingStatus: ProposalBookingStatus.READY_FOR_BOOKING },
        this.scope(user),
      );
      await this.audit.recordForActor(user, undefined, {
        action: 'proposal.ready',
        entity: 'Proposal',
        entityId: id,
      });
    }
    return result;
  }

  /**
   * Book a ready proposal: generate one FulfillmentItem per snapshot item and set
   * bookingStatus = BOOKED. Idempotent-safe: re-booking is rejected once items exist.
   */
  async book(id: string, user: AuthenticatedUser): Promise<{ proposal: ProposalDocument; items: FulfillmentItemDocument[] }> {
    const proposal = await this.getProposalOrThrow(id, user);
    if (proposal.bookingStatus !== ProposalBookingStatus.READY_FOR_BOOKING) {
      throw new BusinessException(
        `A proposal must be READY_FOR_BOOKING to book (is ${proposal.bookingStatus})`,
        'PROPOSAL_NOT_READY',
      );
    }
    const organizationId = this.orgId(user);
    const proposalObjId = new Types.ObjectId(proposal.id as string);
    const existing = await this.items.countByProposal({ organizationId }, proposalObjId);
    if (existing > 0) {
      throw new BusinessException('This proposal has already been booked', 'ALREADY_BOOKED');
    }

    const snapshotItems = proposal.commercialSnapshot?.items ?? [];
    const created: FulfillmentItemDocument[] = [];
    for (const snap of snapshotItems) {
      const item = await this.items.create({
        organizationId,
        proposalId: proposalObjId,
        packageItemId: snap.itemId,
        type: (snap.type as ServiceLineType) ?? ServiceLineType.CUSTOM,
        description: snap.description,
        quantity: snap.quantity,
        vendorRateId: snap.vendorRate?.vendorRateId,
        vendorName: snap.vendorRate?.vendorName,
        status: FulfillmentItemStatus.PENDING,
      });
      created.push(item);
    }

    const updated = await this.proposals.update(
      id,
      { bookingStatus: ProposalBookingStatus.BOOKED },
      this.scope(user),
    );
    await this.audit.recordForActor(user, undefined, {
      action: 'proposal.booked',
      entity: 'Proposal',
      entityId: id,
      newValue: { fulfillmentItems: created.length },
    });
    await this.audit.recordForActor(user, undefined, {
      action: 'fulfillment.created',
      entity: 'Proposal',
      entityId: id,
      metadata: { count: created.length },
    });
    return { proposal: updated ?? proposal, items: created };
  }

  listFulfillmentItems(id: string, user: AuthenticatedUser): Promise<FulfillmentItemDocument[]> {
    return this.getProposalOrThrow(id, user).then((p) =>
      this.items.findByProposal(this.scope(user), new Types.ObjectId(p.id as string)),
    );
  }

  /** Update a fulfillment item's status; re-derive the proposal's booking status. */
  async updateFulfillmentItem(
    proposalId: string,
    itemId: string,
    dto: UpdateFulfillmentItemDto,
    user: AuthenticatedUser,
  ): Promise<FulfillmentItemDocument> {
    const proposal = await this.getProposalOrThrow(proposalId, user);
    await this.findItemOrThrow(proposalId, itemId, user);

    const data: Partial<FulfillmentItem> = {};
    if (dto.status) data.status = dto.status;
    if (dto.confirmationRef !== undefined) data.confirmationRef = dto.confirmationRef;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.items.updateScoped(itemId, data, this.scope(user));
    if (!updated) throw new NotFoundException(`Fulfillment item "${itemId}" not found`, 'FULFILLMENT_ITEM_NOT_FOUND');

    await this.deriveBookingStatus(proposal, user);
    await this.audit.recordForActor(user, undefined, {
      action: 'fulfillment.item.updated',
      entity: 'FulfillmentItem',
      entityId: itemId,
      metadata: { proposalId },
      newValue: { status: updated.status },
    });
    return updated;
  }

  getLineage(id: string, user: AuthenticatedUser): Promise<ProposalLineage> {
    return this.getProposalOrThrow(id, user).then((p) => ({
      leadId: p.leadId?.toString() ?? null,
      inquiryId: p.inquiryId?.toString() ?? null,
      packageId: p.packageId?.toString() ?? null,
      quotationId: p.quotationId?.toString() ?? null,
      quotationNumber: p.quotationNumber ?? null,
      quotationVersion: p.quotationVersion ?? null,
      proposalId: p.id as string,
    }));
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Derive proposal.bookingStatus from its fulfillment items' statuses. */
  private async deriveBookingStatus(proposal: ProposalDocument, user: AuthenticatedUser): Promise<void> {
    const items = await this.items.findByProposal(this.scope(user), new Types.ObjectId(proposal.id as string));
    if (items.length === 0) return;

    const active = items.filter((i) => i.status !== FulfillmentItemStatus.CANCELLED);
    const allDone =
      active.length > 0 && active.every((i) => i.status === FulfillmentItemStatus.DELIVERED);
    const anyProgress = items.some(
      (i) => i.status === FulfillmentItemStatus.CONFIRMED || i.status === FulfillmentItemStatus.DELIVERED,
    );

    let next: ProposalBookingStatus | undefined;
    if (allDone) next = ProposalBookingStatus.COMPLETED;
    else if (anyProgress) next = ProposalBookingStatus.FULFILLING;

    if (next && next !== proposal.bookingStatus) {
      await this.proposals.update(proposal.id as string, { bookingStatus: next }, this.scope(user));
      if (next === ProposalBookingStatus.COMPLETED) {
        await this.audit.recordForActor(user, undefined, {
          action: 'proposal.completed',
          entity: 'Proposal',
          entityId: proposal.id as string,
        });
      }
    }
  }

  private async findItemOrThrow(
    proposalId: string,
    itemId: string,
    user: AuthenticatedUser,
  ): Promise<FulfillmentItemDocument> {
    if (!Types.ObjectId.isValid(itemId)) {
      throw new ValidationException(`"${itemId}" is not a valid id`, 'INVALID_ID');
    }
    const item = await this.items.findByIdScoped(itemId, this.scope(user));
    if (!item || item.proposalId.toString() !== proposalId) {
      throw new NotFoundException(`Fulfillment item "${itemId}" not found`, 'FULFILLMENT_ITEM_NOT_FOUND');
    }
    return item;
  }

  private orgId(user: AuthenticatedUser): Types.ObjectId {
    if (!user.organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    return new Types.ObjectId(user.organizationId);
  }

  private scope(user: AuthenticatedUser): { organizationId: Types.ObjectId } {
    return { organizationId: this.orgId(user) };
  }
}
