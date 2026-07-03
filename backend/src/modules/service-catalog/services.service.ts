import { Injectable } from '@nestjs/common';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { escapeRegExp } from '../../common/utils/regex.util';
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
    const organizationId = this.requireOrg(user);
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
    const scope = this.scope(user);

    const filter: FilterQuery<ServiceDocument> = {};
    if (query.categoryCode) filter.categoryCode = query.categoryCode;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      filter.name = { $regex: escapeRegExp(query.search), $options: 'i' };
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
    const service = await this.services.findByIdScoped(id, this.scope(user));
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

    const updated = await this.services.updateScoped(id, dto, this.scope(user));
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
    const deleted = await this.services.softDeleteScoped(id, this.scope(user));
    if (!deleted) throw new NotFoundException(`Service "${id}" not found`, 'SERVICE_NOT_FOUND');

    await this.auditService.recordForActor(user, undefined, {
      action: 'service.deleted',
      entity: 'Service',
      entityId: id,
    });
  }

  /** Resolves the caller's tenant, rejecting principals without an organization. */
  private requireOrg(user: AuthenticatedUser): Types.ObjectId {
    if (!user.organizationId) {
      throw new BusinessException(
        'An organization is required to manage services',
        'ORGANIZATION_REQUIRED',
      );
    }
    return new Types.ObjectId(user.organizationId);
  }

  /** Query-level tenant scope for the caller's organization. */
  private scope(user: AuthenticatedUser): FilterQuery<ServiceDocument> {
    return { organizationId: this.requireOrg(user) };
  }
}
