import { Injectable } from '@nestjs/common';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { NotFoundException, ValidationException } from '../../common/exceptions/app.exceptions';
import { tenantFilter } from '../../common/tenant/tenant-scope';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { LeadsService } from '../leads/leads.service';
import { LeadActivityType } from '../leads/schemas/lead-activity.schema';
import { LeadStatus } from '../leads/schemas/lead.schema';
import { FollowUpsRepository } from './followups.repository';
import { CreateFollowUpDto } from './dto/create-followup.dto';
import { UpdateFollowUpDto } from './dto/update-followup.dto';
import { QueryFollowUpDto } from './dto/query-followup.dto';
import { FollowUp, FollowUpDocument } from './schemas/followup.schema';

/** Lead states that must not be regressed by scheduling a follow-up. */
const CLOSED_LEAD_STATUSES: LeadStatus[] = [
  LeadStatus.CONFIRMED,
  LeadStatus.REJECTED,
  LeadStatus.COMPLETED,
];

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly followups: FollowUpsRepository,
    private readonly leadsService: LeadsService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateFollowUpDto, actor: AuthenticatedUser): Promise<FollowUpDocument> {
    const lead = await this.leadsService.findByIdOrThrow(dto.leadId, actor);
    const organizationId = lead.organizationId;

    const followup = await this.followups.create({
      organizationId,
      leadId: new Types.ObjectId(dto.leadId),
      scheduledDate: new Date(dto.scheduledDate),
      remarks: dto.remarks,
      nextAction: dto.nextAction,
    });

    // Never drag a won/closed lead backward into FOLLOW_UP.
    if (!CLOSED_LEAD_STATUSES.includes(lead.status)) {
      await this.leadsService.setStatus(dto.leadId, LeadStatus.FOLLOW_UP, organizationId);
    }
    await this.leadsService.appendActivity(
      dto.leadId,
      LeadActivityType.FOLLOW_UP_SCHEDULED,
      `Follow-up scheduled for ${followup.scheduledDate.toISOString()}`,
      organizationId,
      { followupId: followup.id as string },
    );
    await this.audit.recordForActor(actor, undefined, {
      action: 'followup.created',
      entity: 'FollowUp',
      entityId: followup.id as string,
      newValue: { leadId: dto.leadId, scheduledDate: followup.scheduledDate },
    });
    return followup;
  }

  async findAll(query: QueryFollowUpDto, actor: AuthenticatedUser): Promise<PaginatedResponse<FollowUpDocument>> {
    const filter: FilterQuery<FollowUpDocument> = { ...tenantFilter<FollowUpDocument>(actor) };
    if (query.leadId) filter.leadId = new Types.ObjectId(query.leadId);
    if (query.outcome) filter.outcome = query.outcome;
    if (query.completed === 'true') filter.completedAt = { $ne: null };
    if (query.completed === 'false') filter.completedAt = null;

    const sort: Record<string, SortOrder> = {
      [query.sortBy ?? 'scheduledDate']: query.sortOrder,
    };

    const { items, total } = await this.followups.paginate(filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async update(id: string, dto: UpdateFollowUpDto, actor: AuthenticatedUser): Promise<FollowUpDocument> {
    const existing = await this.findByIdOrThrow(id, actor);

    const data: Partial<FollowUp> = {
      ...(dto.scheduledDate !== undefined ? { scheduledDate: new Date(dto.scheduledDate) } : {}),
      ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
      ...(dto.nextAction !== undefined ? { nextAction: dto.nextAction } : {}),
    };

    // Recording an outcome marks the follow-up complete.
    if (dto.outcome !== undefined) {
      data.outcome = dto.outcome;
      data.completedAt = new Date();
    }

    const updated = await this.followups.update(id, data, tenantFilter<FollowUpDocument>(actor));
    if (!updated) {
      throw new NotFoundException(`Follow-up "${id}" not found`, 'FOLLOWUP_NOT_FOUND');
    }

    if (dto.outcome !== undefined) {
      await this.leadsService.appendActivity(
        existing.leadId.toString(),
        LeadActivityType.FOLLOW_UP_COMPLETED,
        `Follow-up completed with outcome ${dto.outcome}`,
        existing.organizationId,
        { followupId: updated.id as string },
      );
    }
    await this.audit.recordForActor(actor, undefined, {
      action: 'followup.updated',
      entity: 'FollowUp',
      entityId: id,
      newValue: { outcome: updated.outcome },
    });
    return updated;
  }

  async findByIdOrThrow(id: string, actor: AuthenticatedUser): Promise<FollowUpDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const followup = await this.followups.findById(id, tenantFilter<FollowUpDocument>(actor));
    if (!followup) {
      throw new NotFoundException(`Follow-up "${id}" not found`, 'FOLLOWUP_NOT_FOUND');
    }
    return followup;
  }
}
