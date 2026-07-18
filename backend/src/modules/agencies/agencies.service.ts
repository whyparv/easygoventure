import { Injectable } from '@nestjs/common';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { escapeRegExp } from '../../common/utils/regex.util';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { AgenciesRepository } from './agencies.repository';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { QueryAgencyDto } from './dto/query-agency.dto';
import { Agency, AgencyDocument } from './schemas/agency.schema';

@Injectable()
export class AgenciesService {
  constructor(
    private readonly agencies: AgenciesRepository,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateAgencyDto, user: AuthenticatedUser): Promise<AgencyDocument> {
    const organizationId = this.orgId(user);

    // Check for a name conflict (case-insensitive exact match) within the tenant.
    const existing = await this.agencies.findOne({
      organizationId,
      name: { $regex: `^${escapeRegExp(dto.name)}$`, $options: 'i' },
      isDeleted: false,
    });
    if (existing) {
      throw new BusinessException(
        `An agency named "${dto.name}" already exists`,
        'AGENCY_NAME_CONFLICT',
      );
    }

    const data: Partial<Agency> = {
      organizationId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      contactPerson: dto.contactPerson,
      city: dto.city,
      country: dto.country,
      address: dto.address,
      website: dto.website,
      notes: dto.notes,
      isActive: dto.isActive ?? true,
    };
    const agency = await this.agencies.create(data);
    await this.audit.recordForActor(user, undefined, {
      action: 'agency.created',
      entity: Agency.name,
      entityId: agency.id as string,
      newValue: { name: agency.name },
    });
    return agency;
  }

  async findAll(
    query: QueryAgencyDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<AgencyDocument>> {
    const filter: FilterQuery<AgencyDocument> = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      const term = escapeRegExp(query.search);
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { contactPerson: { $regex: term, $options: 'i' } },
      ];
    }

    const sort: Record<string, SortOrder> = {
      [query.sortBy ?? 'createdAt']: query.sortOrder,
    };

    const { items, total } = await this.agencies.paginateScoped(this.scope(user), filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, user: AuthenticatedUser): Promise<AgencyDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const agency = await this.agencies.findByIdScoped(id, this.scope(user));
    if (!agency) throw new NotFoundException(`Agency "${id}" not found`, 'AGENCY_NOT_FOUND');
    return agency;
  }

  async update(
    id: string,
    dto: UpdateAgencyDto,
    user: AuthenticatedUser,
  ): Promise<AgencyDocument> {
    await this.findByIdOrThrow(id, user);
    const updated = await this.agencies.updateScoped(id, dto, this.scope(user));
    if (!updated) throw new NotFoundException(`Agency "${id}" not found`, 'AGENCY_NOT_FOUND');

    await this.audit.recordForActor(user, undefined, {
      action: 'agency.updated',
      entity: Agency.name,
      entityId: id,
      newValue: dto as Record<string, unknown>,
    });
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findByIdOrThrow(id, user);
    const deleted = await this.agencies.softDeleteScoped(id, this.scope(user));
    if (!deleted) throw new NotFoundException(`Agency "${id}" not found`, 'AGENCY_NOT_FOUND');

    await this.audit.recordForActor(user, undefined, {
      action: 'agency.deleted',
      entity: Agency.name,
      entityId: id,
    });
  }

  /**
   * Find an agency by name (case-insensitive exact match), or create it if not found.
   * Used for auto-create during lead submission.
   */
  async findOrCreate(
    name: string,
    phone: string | undefined,
    email: string | undefined,
    user: AuthenticatedUser,
  ): Promise<AgencyDocument> {
    const organizationId = this.orgId(user);
    const existing = await this.agencies.findOne({
      organizationId,
      name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' },
      isDeleted: false,
    });
    if (existing) return existing as AgencyDocument;

    return this.create({ name, phone, email }, user);
  }

  /** Resolve the caller's tenant, rejecting principals with no organization. */
  private orgId(user: AuthenticatedUser): Types.ObjectId {
    if (!user.organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    return new Types.ObjectId(user.organizationId);
  }

  /** Query-level tenant scope for the caller's organization. */
  private scope(user: AuthenticatedUser): FilterQuery<AgencyDocument> {
    return { organizationId: this.orgId(user) };
  }
}
