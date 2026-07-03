import { Injectable } from '@nestjs/common';
import { ClientSession, FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { NotFoundException, ValidationException } from '../../common/exceptions/app.exceptions';
import { tenantFilter } from '../../common/tenant/tenant-scope';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { LeadsService } from '../leads/leads.service';
import { LeadActivityType } from '../leads/schemas/lead-activity.schema';
import { LeadStatus } from '../leads/schemas/lead.schema';
import { FulfillmentsRepository } from './fulfillments.repository';
import { CreateFulfillmentDto } from './dto/create-fulfillment.dto';
import { UpdateFulfillmentDto } from './dto/update-fulfillment.dto';
import { QueryFulfillmentDto } from './dto/query-fulfillment.dto';
import {
  Fulfillment,
  FulfillmentDocument,
  FulfillmentStatus,
  FulfillmentType,
} from './schemas/fulfillment.schema';

/** Map a proposal type onto the matching fulfillment workstream. */
const PROPOSAL_TO_FULFILLMENT: Record<string, FulfillmentType> = {
  VISA: FulfillmentType.VISA,
  TRAVEL_PACKAGE: FulfillmentType.TRAVEL_PACKAGE,
  HOTEL: FulfillmentType.HOTEL,
  TRANSFER: FulfillmentType.TRANSFER,
  CUSTOM: FulfillmentType.CUSTOM,
};

/** A fulfillment in one of these states no longer needs work. */
const TERMINAL_STATUSES: string[] = [FulfillmentStatus.COMPLETED, FulfillmentStatus.CANCELLED];

export interface CreateFromProposalInput {
  organizationId: string | Types.ObjectId;
  leadId: string;
  proposalId: string;
  proposalType: string;
}

@Injectable()
export class FulfillmentsService {
  constructor(
    private readonly fulfillments: FulfillmentsRepository,
    private readonly leadsService: LeadsService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateFulfillmentDto, actor: AuthenticatedUser): Promise<FulfillmentDocument> {
    const lead = await this.leadsService.findByIdOrThrow(dto.leadId, actor);
    const organizationId = lead.organizationId;

    const fulfillment = await this.fulfillments.create({
      organizationId,
      leadId: new Types.ObjectId(dto.leadId),
      proposalId: dto.proposalId ? new Types.ObjectId(dto.proposalId) : undefined,
      type: dto.type,
      status: dto.status ?? FulfillmentStatus.PENDING,
      remarks: dto.remarks,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    await this.leadsService.appendActivity(
      dto.leadId,
      LeadActivityType.FULFILLMENT_CREATED,
      `Fulfillment (${fulfillment.type}) created`,
      organizationId,
      { fulfillmentId: fulfillment.id as string },
    );
    await this.audit.recordForActor(actor, undefined, {
      action: 'fulfillment.created',
      entity: 'Fulfillment',
      entityId: fulfillment.id as string,
      newValue: { type: fulfillment.type, leadId: dto.leadId },
    });
    return fulfillment;
  }

  /**
   * Called by the proposals workflow when a proposal is accepted. The tenant
   * `organizationId` is propagated from the accepted proposal so the created
   * fulfillment stays in the same organization.
   */
  async createFromAcceptedProposal(
    input: CreateFromProposalInput,
    session?: ClientSession,
  ): Promise<FulfillmentDocument> {
    const type = PROPOSAL_TO_FULFILLMENT[input.proposalType] ?? FulfillmentType.CUSTOM;

    const fulfillment = await this.fulfillments.create(
      {
        organizationId: this.asObjectId(input.organizationId),
        leadId: new Types.ObjectId(input.leadId),
        proposalId: new Types.ObjectId(input.proposalId),
        type,
        status: FulfillmentStatus.PENDING,
      },
      session,
    );

    await this.leadsService.appendActivity(
      input.leadId,
      LeadActivityType.FULFILLMENT_CREATED,
      `Fulfillment (${type}) opened from accepted proposal`,
      input.organizationId,
      { fulfillmentId: fulfillment.id as string, proposalId: input.proposalId },
      session,
    );
    return fulfillment;
  }

  async findAll(query: QueryFulfillmentDto, actor: AuthenticatedUser): Promise<PaginatedResponse<FulfillmentDocument>> {
    const filter: FilterQuery<FulfillmentDocument> = { ...tenantFilter<FulfillmentDocument>(actor) };
    if (query.leadId) filter.leadId = new Types.ObjectId(query.leadId);
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;

    const sort: Record<string, SortOrder> = {
      [query.sortBy ?? 'createdAt']: query.sortOrder,
    };

    const { items, total } = await this.fulfillments.paginate(filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, actor: AuthenticatedUser): Promise<FulfillmentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const fulfillment = await this.fulfillments.findById(id, tenantFilter<FulfillmentDocument>(actor));
    if (!fulfillment) {
      throw new NotFoundException(`Fulfillment "${id}" not found`, 'FULFILLMENT_NOT_FOUND');
    }
    return fulfillment;
  }

  async update(id: string, dto: UpdateFulfillmentDto, actor: AuthenticatedUser): Promise<FulfillmentDocument> {
    const existing = await this.findByIdOrThrow(id, actor);

    const data: Partial<Fulfillment> = {
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
    };

    const updated = await this.fulfillments.update(id, data, tenantFilter<FulfillmentDocument>(actor));
    if (!updated) {
      throw new NotFoundException(`Fulfillment "${id}" not found`, 'FULFILLMENT_NOT_FOUND');
    }

    const leadId = existing.leadId.toString();
    const organizationId = existing.organizationId;
    await this.leadsService.appendActivity(
      leadId,
      LeadActivityType.FULFILLMENT_UPDATED,
      `Fulfillment (${updated.type}) updated to ${updated.status}`,
      organizationId,
      { fulfillmentId: updated.id as string },
    );

    // The lead is only COMPLETED once every related fulfillment is resolved
    // (completed or cancelled) — a single completion no longer closes the lead.
    if (updated.status === FulfillmentStatus.COMPLETED) {
      const unresolved = await this.fulfillments.countUnresolvedByLead(
        existing.leadId,
        TERMINAL_STATUSES,
        { organizationId },
      );
      if (unresolved === 0) {
        await this.leadsService.setStatus(leadId, LeadStatus.COMPLETED, organizationId);
      }
    }
    await this.audit.recordForActor(actor, undefined, {
      action: 'fulfillment.updated',
      entity: 'Fulfillment',
      entityId: id,
      newValue: { status: updated.status },
    });
    return updated;
  }

  private asObjectId(id: string | Types.ObjectId): Types.ObjectId {
    return id instanceof Types.ObjectId ? id : new Types.ObjectId(id);
  }
}
