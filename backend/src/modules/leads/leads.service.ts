import { Injectable } from '@nestjs/common';
import { ClientSession, FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { NotFoundException, ValidationException } from '../../common/exceptions/app.exceptions';
import { escapeRegExp } from '../../common/utils/regex.util';
import { requireOrganizationId, tenantFilter } from '../../common/tenant/tenant-scope';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AgenciesService } from '../agencies/agencies.service';
import { LeadsRepository } from './leads.repository';
import { LeadActivitiesRepository } from './lead-activities.repository';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { CreateLeadActivityDto } from './dto/create-lead-activity.dto';
import { LeadDocument, LeadStatus } from './schemas/lead.schema';
import {
  LeadActivityDocument,
  LeadActivityType,
} from './schemas/lead-activity.schema';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leads: LeadsRepository,
    private readonly activities: LeadActivitiesRepository,
    private readonly audit: AuditService,
    private readonly agenciesService: AgenciesService,
  ) {}

  async create(dto: CreateLeadDto, actor: AuthenticatedUser): Promise<LeadDocument> {
    const organizationId = requireOrganizationId(actor);

    // Auto-create agency if a company name is provided and no agency exists yet
    if (dto.companyName?.trim()) {
      await this.agenciesService
        .findOrCreate(dto.companyName.trim(), dto.phone, dto.email, actor)
        .catch(() => null); // never fail lead creation because of agency
    }

    const lead = await this.leads.create({ ...dto, organizationId } as never);
    await this.appendActivity(
      lead.id as string,
      LeadActivityType.LEAD_CREATED,
      `Lead created from ${lead.source} (${lead.inquiryType})`,
      organizationId,
    );
    await this.audit.recordForActor(actor, undefined, {
      action: 'lead.created',
      entity: 'Lead',
      entityId: lead.id as string,
      newValue: { name: lead.name, inquiryType: lead.inquiryType },
    });
    return lead;
  }

  async findAll(query: QueryLeadDto, actor: AuthenticatedUser): Promise<PaginatedResponse<LeadDocument>> {
    const filter: FilterQuery<LeadDocument> = { ...tenantFilter<LeadDocument>(actor) };
    if (query.status) filter.status = query.status;
    if (query.inquiryType) filter.inquiryType = query.inquiryType;
    if (query.source) filter.source = query.source;
    if (query.search) {
      const term = escapeRegExp(query.search);
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { companyName: { $regex: term, $options: 'i' } },
      ];
    }

    const sort: Record<string, SortOrder> = {
      [query.sortBy ?? 'createdAt']: query.sortOrder,
    };

    const { items, total } = await this.leads.paginate(filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, actor: AuthenticatedUser): Promise<LeadDocument> {
    this.assertObjectId(id);
    const lead = await this.leads.findById(id, tenantFilter<LeadDocument>(actor));
    if (!lead) throw new NotFoundException(`Lead "${id}" not found`, 'LEAD_NOT_FOUND');
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, actor: AuthenticatedUser): Promise<LeadDocument> {
    const existing = await this.findByIdOrThrow(id, actor);
    const statusChanged = dto.status !== undefined && dto.status !== existing.status;

    const updated = await this.leads.update(id, dto as never, tenantFilter<LeadDocument>(actor));
    if (!updated) throw new NotFoundException(`Lead "${id}" not found`, 'LEAD_NOT_FOUND');

    if (statusChanged) {
      await this.appendActivity(
        id,
        LeadActivityType.STATUS_CHANGED,
        `Status changed from ${existing.status} to ${updated.status}`,
        existing.organizationId,
      );
    } else {
      await this.appendActivity(
        id,
        LeadActivityType.LEAD_UPDATED,
        'Lead details updated',
        existing.organizationId,
      );
    }
    await this.audit.recordForActor(actor, undefined, {
      action: 'lead.updated',
      entity: 'Lead',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: updated.status },
    });
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    // findByIdOrThrow already excludes soft-deleted leads → idempotent 404.
    await this.findByIdOrThrow(id, actor);
    const deleted = await this.leads.softDelete(id, tenantFilter<LeadDocument>(actor));
    if (!deleted) throw new NotFoundException(`Lead "${id}" not found`, 'LEAD_NOT_FOUND');
    await this.audit.recordForActor(actor, undefined, {
      action: 'lead.deleted',
      entity: 'Lead',
      entityId: id,
    });
  }

  // ── Timeline ───────────────────────────────────────────────────────────────

  async addActivity(
    leadId: string,
    dto: CreateLeadActivityDto,
    actor: AuthenticatedUser,
  ): Promise<LeadActivityDocument> {
    const lead = await this.findByIdOrThrow(leadId, actor);
    return this.activities.create({ organizationId: lead.organizationId, leadId, ...dto });
  }

  async listActivities(leadId: string, actor: AuthenticatedUser): Promise<LeadActivityDocument[]> {
    await this.findByIdOrThrow(leadId, actor);
    return this.activities.findByLead(leadId, tenantFilter<LeadActivityDocument>(actor));
  }

  /**
   * Append a timeline entry. Public so sibling modules (proposals, fulfillments,
   * follow-ups) can record their own events against a lead - they pass the
   * record's `organizationId` so every activity stays tenant-scoped.
   */
  appendActivity(
    leadId: string,
    type: LeadActivityType,
    description: string,
    organizationId: string | Types.ObjectId,
    metadata?: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<LeadActivityDocument> {
    return this.activities.create(
      { organizationId, leadId, type, description, metadata },
      session,
    );
  }

  /**
   * Transition a lead's status and log it, scoped to the lead's organization.
   * Accepts an optional session so it can participate in a workflow transaction
   * (e.g. proposal acceptance).
   */
  async setStatus(
    leadId: string,
    status: LeadStatus,
    organizationId: string | Types.ObjectId,
    session?: ClientSession,
  ): Promise<LeadDocument> {
    const tenant: FilterQuery<LeadDocument> = { organizationId: this.asObjectId(organizationId) };
    const lead = await this.leads.findById(leadId, tenant);
    if (!lead) throw new NotFoundException(`Lead "${leadId}" not found`, 'LEAD_NOT_FOUND');
    if (lead.status === status) return lead;

    const updated = await this.leads.update(leadId, { status }, tenant, session);
    if (!updated) throw new NotFoundException(`Lead "${leadId}" not found`, 'LEAD_NOT_FOUND');

    await this.appendActivity(
      leadId,
      LeadActivityType.STATUS_CHANGED,
      `Status changed from ${lead.status} to ${status}`,
      organizationId,
      undefined,
      session,
    );
    return updated;
  }

  private asObjectId(id: string | Types.ObjectId): Types.ObjectId {
    return id instanceof Types.ObjectId ? id : new Types.ObjectId(id);
  }

  private assertObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
  }
}
