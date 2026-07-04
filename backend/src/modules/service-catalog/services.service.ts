import { Injectable } from '@nestjs/common';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { NotFoundException, ValidationException } from '../../common/exceptions/app.exceptions';
import { escapeRegExp } from '../../common/utils/regex.util';
import { requireOrganizationId, tenantFilter } from '../../common/tenant/tenant-scope';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ServicesRepository } from './services.repository';
import { ServiceCategoriesService } from './service-categories.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryServiceDto } from './dto/query-service.dto';
import { ServiceDocument } from './schemas/service.schema';

@Injectable()
export class ServicesService {
  constructor(
    private readonly services: ServicesRepository,
    private readonly serviceCategories: ServiceCategoriesService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateServiceDto, user: AuthenticatedUser): Promise<ServiceDocument> {
    const organizationId = requireOrganizationId(user);
    await this.serviceCategories.findByCodeOrThrow(dto.categoryCode);

    const created = await this.services.create({
      ...dto,
      organizationId,
    });

    await this.auditService.recordForActor(user, undefined, {
      action: 'service.created',
      entity: 'Service',
      entityId: created.id as string,
      newValue: {
        categoryCode: created.categoryCode,
        name: created.name,
        currency: created.currency,
        basePrice: created.basePrice,
        isActive: created.isActive,
      },
    });

    return created;
  }

  async findAll(
    query: QueryServiceDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<ServiceDocument>> {
    // Super-admins get an unscoped ({}) filter; every other principal is scoped to
    // their organization — consistent with leads and the rest of the platform.
    const scope = tenantFilter<ServiceDocument>(user);

    const filter: FilterQuery<ServiceDocument> = {};
    if (query.categoryCode) filter.categoryCode = query.categoryCode.toUpperCase();
    if (query.destination) {
      filter.destination = { $regex: `^${escapeRegExp(query.destination)}$`, $options: 'i' };
    }
    if (query.variantGroup) {
      filter.variantGroup = { $regex: `^${escapeRegExp(query.variantGroup)}$`, $options: 'i' };
    }
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    if (query.search) {
      const term = escapeRegExp(query.search);
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { serviceType: { $regex: term, $options: 'i' } },
        { supplier: { $regex: term, $options: 'i' } },
        { variantGroup: { $regex: term, $options: 'i' } },
      ];
    }

    const sort: Record<string, SortOrder> = {
      [query.sortBy ?? 'createdAt']: query.sortOrder,
    };

    const { items, total } = await this.services.paginateScoped(scope, filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, user: AuthenticatedUser): Promise<ServiceDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    // Tenant isolation is enforced in the query — a service outside the caller's
    // organization is never fetched, and simply reads as "not found".
    const service = await this.services.findByIdScoped(id, tenantFilter<ServiceDocument>(user));
    if (!service) {
      throw new NotFoundException(`Service "${id}" not found`, 'SERVICE_NOT_FOUND');
    }
    return service;
  }

  async update(
    id: string,
    dto: UpdateServiceDto,
    user: AuthenticatedUser,
  ): Promise<ServiceDocument> {
    const existing = await this.findByIdOrThrow(id, user);
    if (dto.categoryCode) {
      await this.serviceCategories.findByCodeOrThrow(dto.categoryCode);
    }

    const updated = await this.services.updateScoped(id, dto, tenantFilter<ServiceDocument>(user));
    if (!updated) throw new NotFoundException(`Service "${id}" not found`, 'SERVICE_NOT_FOUND');

    await this.auditService.recordForActor(user, undefined, {
      action: 'service.updated',
      entity: 'Service',
      entityId: id,
      oldValue: {
        categoryCode: existing.categoryCode,
        name: existing.name,
        currency: existing.currency,
        basePrice: existing.basePrice,
        isActive: existing.isActive,
      },
      newValue: {
        categoryCode: updated.categoryCode,
        name: updated.name,
        currency: updated.currency,
        basePrice: updated.basePrice,
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    // findByIdOrThrow already excludes soft-deleted services → idempotent 404.
    await this.findByIdOrThrow(id, user);
    const deleted = await this.services.softDeleteScoped(id, tenantFilter<ServiceDocument>(user));
    if (!deleted) throw new NotFoundException(`Service "${id}" not found`, 'SERVICE_NOT_FOUND');

    await this.auditService.recordForActor(user, undefined, {
      action: 'service.deleted',
      entity: 'Service',
      entityId: id,
    });
  }
}
