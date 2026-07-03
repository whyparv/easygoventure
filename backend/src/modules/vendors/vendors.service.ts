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
import { VendorsRepository } from './vendors.repository';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { QueryVendorDto } from './dto/query-vendor.dto';
import { Vendor, VendorDocument } from './schemas/vendor.schema';

@Injectable()
export class VendorsService {
  constructor(
    private readonly vendors: VendorsRepository,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateVendorDto, user: AuthenticatedUser): Promise<VendorDocument> {
    const organizationId = this.orgId(user);
    const data: Partial<Vendor> = {
      organizationId,
      name: dto.name,
      contactPerson: dto.contactPerson,
      phone: dto.phone,
      email: dto.email,
      supportedServices: dto.supportedServices ?? [],
      paymentTerms: dto.paymentTerms,
      notes: dto.notes,
      isActive: dto.isActive ?? true,
    };
    const vendor = await this.vendors.create(data);
    await this.audit.recordForActor(user, undefined, {
      action: 'vendor.created',
      entity: Vendor.name,
      entityId: vendor.id as string,
      newValue: { name: vendor.name },
    });
    return vendor;
  }

  async findAll(
    query: QueryVendorDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<VendorDocument>> {
    const filter: FilterQuery<VendorDocument> = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      const term = escapeRegExp(query.search);
      filter.name = { $regex: term, $options: 'i' };
    }

    const sort: Record<string, SortOrder> = {
      [query.sortBy ?? 'createdAt']: query.sortOrder,
    };

    const { items, total } = await this.vendors.paginateScoped(this.scope(user), filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, user: AuthenticatedUser): Promise<VendorDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const vendor = await this.vendors.findByIdScoped(id, this.scope(user));
    if (!vendor) throw new NotFoundException(`Vendor "${id}" not found`, 'VENDOR_NOT_FOUND');
    return vendor;
  }

  async update(
    id: string,
    dto: UpdateVendorDto,
    user: AuthenticatedUser,
  ): Promise<VendorDocument> {
    await this.findByIdOrThrow(id, user);
    const updated = await this.vendors.updateScoped(id, dto, this.scope(user));
    if (!updated) throw new NotFoundException(`Vendor "${id}" not found`, 'VENDOR_NOT_FOUND');

    await this.audit.recordForActor(user, undefined, {
      action: 'vendor.updated',
      entity: Vendor.name,
      entityId: id,
      newValue: dto as Record<string, unknown>,
    });
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    // findByIdOrThrow already excludes soft-deleted vendors → idempotent 404.
    await this.findByIdOrThrow(id, user);
    const deleted = await this.vendors.softDeleteScoped(id, this.scope(user));
    if (!deleted) throw new NotFoundException(`Vendor "${id}" not found`, 'VENDOR_NOT_FOUND');

    await this.audit.recordForActor(user, undefined, {
      action: 'vendor.deleted',
      entity: Vendor.name,
      entityId: id,
    });
  }

  /** Resolve the caller's tenant, rejecting principals with no organization. */
  private orgId(user: AuthenticatedUser): Types.ObjectId {
    if (!user.organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    return new Types.ObjectId(user.organizationId);
  }

  /** Query-level tenant scope for the caller's organization. */
  private scope(user: AuthenticatedUser): FilterQuery<VendorDocument> {
    return { organizationId: this.orgId(user) };
  }
}
