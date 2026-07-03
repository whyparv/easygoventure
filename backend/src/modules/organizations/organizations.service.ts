import { ForbiddenException, Injectable } from '@nestjs/common';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import {
  EntityConflictException,
} from '../../common/exceptions/domain.exception';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrganizationsRepository } from './organizations.repository';
import { Organization, OrganizationDocument } from './schemas/organization.schema';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { QueryOrganizationDto } from './dto/query-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizations: OrganizationsRepository,
    private readonly audit: AuditService,
  ) {}

  /** Provisioning a new tenant is a platform (SUPER_ADMIN) action. */
  async create(dto: CreateOrganizationDto, user: AuthenticatedUser): Promise<OrganizationDocument> {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('Only a platform super-admin can create organizations');
    }
    const slug = this.normalizeSlug(dto.slug);
    if (await this.organizations.findBySlug(slug)) {
      throw new EntityConflictException(`Organization slug "${slug}" is already taken`);
    }

    const created = await this.organizations.create({
      name: dto.name,
      slug,
      logo: dto.logo,
      timezone: dto.timezone ?? 'Asia/Dubai',
      currency: (dto.currency ?? 'USD').toUpperCase(),
      subscriptionPlan: dto.subscriptionPlan ?? 'FREE',
      settings: dto.settings ?? {},
      isActive: true,
    });

    await this.audit.recordForActor(user, undefined, {
      action: 'organization.created',
      entity: 'Organization',
      entityId: created.id as string,
      organizationId: created.id as string,
      newValue: { name: created.name, slug: created.slug },
    });
    return created;
  }

  async findAll(
    query: QueryOrganizationDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<OrganizationDocument>> {
    const filter: FilterQuery<OrganizationDocument> = {};
    if (query.search) filter.name = { $regex: query.search, $options: 'i' };
    // Non-super-admins can only ever see their own organization.
    if (!user.isSuperAdmin && !user.organizationId) {
      return new PaginatedResponse([], 0, query.page, query.limit);
    }

    const sort: Record<string, SortOrder> = { [query.sortBy ?? 'createdAt']: query.sortOrder };
    const { items, total } = await this.organizations.paginateScoped(this.ownScope(user), filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, user: AuthenticatedUser): Promise<OrganizationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    this.assertCanAccess(id, user);
    const org = await this.organizations.findById(id);
    if (!org) throw new NotFoundException(`Organization "${id}" not found`, 'ORGANIZATION_NOT_FOUND');
    return org;
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    user: AuthenticatedUser,
  ): Promise<OrganizationDocument> {
    const existing = await this.findByIdOrThrow(id, user);
    const data: Partial<Organization> = {
      name: dto.name,
      logo: dto.logo,
      timezone: dto.timezone,
      currency: dto.currency ? dto.currency.toUpperCase() : undefined,
      subscriptionPlan: dto.subscriptionPlan,
      settings: dto.settings,
      isActive: dto.isActive,
    };
    const updated = await this.organizations.updateScoped(id, data, this.ownScope(user));
    if (!updated) throw new NotFoundException(`Organization "${id}" not found`, 'ORGANIZATION_NOT_FOUND');

    await this.audit.recordForActor(user, undefined, {
      action: 'organization.updated',
      entity: 'Organization',
      entityId: id,
      organizationId: id,
      oldValue: { name: existing.name, isActive: existing.isActive },
      newValue: { name: updated.name, isActive: updated.isActive },
    });
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    if (!user.isSuperAdmin) {
      throw new ForbiddenException('Only a platform super-admin can delete organizations');
    }
    await this.findByIdOrThrow(id, user);
    await this.organizations.softDeleteScoped(id, this.ownScope(user));
    await this.audit.recordForActor(user, undefined, {
      action: 'organization.deleted',
      entity: 'Organization',
      entityId: id,
      organizationId: id,
    });
  }

  private assertCanAccess(id: string, user: AuthenticatedUser): void {
    if (user.isSuperAdmin) return;
    if (user.organizationId !== id) {
      throw new ForbiddenException('You cannot access another organization');
    }
  }

  /**
   * Query scope for the Organization collection (the tenant root). Super-admins are
   * unconstrained; every other principal is pinned to their own organization by
   * `_id`, so a scoped write can never reach another tenant's organization.
   */
  private ownScope(user: AuthenticatedUser): FilterQuery<OrganizationDocument> {
    if (user.isSuperAdmin) return {};
    if (!user.organizationId) {
      throw new ForbiddenException('You cannot access another organization');
    }
    return { _id: new Types.ObjectId(user.organizationId) };
  }

  private normalizeSlug(slug: string): string {
    const normalized = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!normalized) throw new BusinessException('Invalid organization slug', 'INVALID_SLUG');
    return normalized;
  }
}
