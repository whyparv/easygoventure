import { Injectable } from '@nestjs/common';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { EntityConflictException } from '../../common/exceptions/domain.exception';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { VendorRatesRepository } from './vendor-rates.repository';
import { VendorsService } from './vendors.service';
import { CreateVendorRateDto } from './dto/create-vendor-rate.dto';
import { UpdateVendorRateDto } from './dto/update-vendor-rate.dto';
import { QueryVendorRateDto } from './dto/query-vendor-rate.dto';
import {
  ServiceLineType,
  VendorRate,
  VendorRateDocument,
  VendorRateStatus,
} from './schemas/vendor-rate.schema';

/** The dimensions that define whether two rates target the same thing. */
interface OverlapInput {
  vendorId: string;
  rateType: ServiceLineType;
  serviceId?: string;
  hotelId?: string;
  serviceCode?: string;
  validFrom: Date;
  validTo?: Date;
}

@Injectable()
export class VendorRatesService {
  constructor(
    private readonly rates: VendorRatesRepository,
    private readonly vendors: VendorsService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateVendorRateDto,
    user: AuthenticatedUser,
  ): Promise<VendorRateDocument> {
    const organizationId = this.orgId(user);
    // Ensures the vendor exists in the caller's organization (or throws 404).
    await this.vendors.findByIdOrThrow(dto.vendorId, user);

    const status = dto.status ?? VendorRateStatus.ACTIVE;
    const validFrom = new Date(dto.validFrom);
    const validTo = dto.validTo ? new Date(dto.validTo) : undefined;
    this.assertValidWindow(validFrom, validTo);

    // Only ACTIVE rates compete for a validity window; DRAFT rates never conflict.
    if (status === VendorRateStatus.ACTIVE) {
      await this.assertNoOverlap(user, {
        vendorId: dto.vendorId,
        rateType: dto.rateType,
        serviceId: dto.serviceId,
        hotelId: dto.hotelId,
        serviceCode: dto.serviceCode,
        validFrom,
        validTo,
      });
    }

    const data: Partial<VendorRate> = {
      organizationId,
      vendorId: new Types.ObjectId(dto.vendorId),
      rateType: dto.rateType,
      serviceId: dto.serviceId ? new Types.ObjectId(dto.serviceId) : undefined,
      hotelId: dto.hotelId ? new Types.ObjectId(dto.hotelId) : undefined,
      serviceCode: dto.serviceCode,
      currency: dto.currency ?? 'USD',
      netCost: dto.netCost,
      unit: dto.unit,
      minimumPax: dto.minimumPax,
      maximumPax: dto.maximumPax,
      validFrom,
      validTo,
      status,
      notes: dto.notes,
      isActive: dto.isActive ?? true,
    };
    const rate = await this.rates.create(data);
    await this.audit.recordForActor(user, undefined, {
      action: 'vendor_rate.created',
      entity: VendorRate.name,
      entityId: rate.id as string,
      newValue: { vendorId: dto.vendorId, rateType: dto.rateType, netCost: dto.netCost },
    });
    return rate;
  }

  async findAll(
    query: QueryVendorRateDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<VendorRateDocument>> {
    const filter: FilterQuery<VendorRateDocument> = {};
    if (query.vendorId && Types.ObjectId.isValid(query.vendorId)) {
      filter.vendorId = new Types.ObjectId(query.vendorId);
    }
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const sort: Record<string, SortOrder> = {
      [query.sortBy ?? 'createdAt']: query.sortOrder,
    };

    const { items, total } = await this.rates.paginateScoped(this.scope(user), filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, user: AuthenticatedUser): Promise<VendorRateDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const rate = await this.rates.findByIdScoped(id, this.scope(user));
    if (!rate) {
      throw new NotFoundException(`Vendor rate "${id}" not found`, 'VENDOR_RATE_NOT_FOUND');
    }
    return rate;
  }

  async update(
    id: string,
    dto: UpdateVendorRateDto,
    user: AuthenticatedUser,
  ): Promise<VendorRateDocument> {
    const existing = await this.findByIdOrThrow(id, user);
    // If the rate is re-pointed to another vendor, that vendor must be in-tenant.
    if (dto.vendorId) await this.vendors.findByIdOrThrow(dto.vendorId, user);

    // Resolve the effective window/target/status (dto over existing) and re-check overlap.
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : existing.validFrom;
    const validTo = dto.validTo ? new Date(dto.validTo) : existing.validTo;
    this.assertValidWindow(validFrom, validTo);
    const effectiveStatus = dto.status ?? existing.status;
    if (effectiveStatus === VendorRateStatus.ACTIVE) {
      await this.assertNoOverlap(
        user,
        {
          vendorId: dto.vendorId ?? existing.vendorId.toString(),
          rateType: dto.rateType ?? existing.rateType,
          serviceId: dto.serviceId ?? existing.serviceId?.toString(),
          hotelId: dto.hotelId ?? existing.hotelId?.toString(),
          serviceCode: dto.serviceCode ?? existing.serviceCode,
          validFrom,
          validTo,
        },
        id,
      );
    }

    const data: Partial<VendorRate> = {
      serviceCode: dto.serviceCode,
      currency: dto.currency,
      netCost: dto.netCost,
      unit: dto.unit,
      isActive: dto.isActive,
    };
    if (dto.vendorId) data.vendorId = new Types.ObjectId(dto.vendorId);
    if (dto.rateType) data.rateType = dto.rateType;
    if (dto.serviceId) data.serviceId = new Types.ObjectId(dto.serviceId);
    if (dto.hotelId) data.hotelId = new Types.ObjectId(dto.hotelId);
    if (dto.minimumPax !== undefined) data.minimumPax = dto.minimumPax;
    if (dto.maximumPax !== undefined) data.maximumPax = dto.maximumPax;
    if (dto.validFrom) data.validFrom = validFrom;
    if (dto.validTo) data.validTo = validTo;
    if (dto.status) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.rates.updateScoped(id, data, this.scope(user));
    if (!updated) {
      throw new NotFoundException(`Vendor rate "${id}" not found`, 'VENDOR_RATE_NOT_FOUND');
    }

    await this.audit.recordForActor(user, undefined, {
      action: 'vendor_rate.updated',
      entity: VendorRate.name,
      entityId: id,
      newValue: dto as Record<string, unknown>,
    });
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    // findByIdOrThrow already excludes soft-deleted rates → idempotent 404.
    await this.findByIdOrThrow(id, user);
    const deleted = await this.rates.softDeleteScoped(id, this.scope(user));
    if (!deleted) {
      throw new NotFoundException(`Vendor rate "${id}" not found`, 'VENDOR_RATE_NOT_FOUND');
    }

    await this.audit.recordForActor(user, undefined, {
      action: 'vendor_rate.deleted',
      entity: VendorRate.name,
      entityId: id,
    });
  }

  // ── Overlap / validity validation ──────────────────────────────────────

  private assertValidWindow(validFrom: Date, validTo?: Date): void {
    if (validTo && validTo.getTime() < validFrom.getTime()) {
      throw new ValidationException('validTo must be on or after validFrom', 'INVALID_RATE_WINDOW');
    }
  }

  /**
   * Rejects a new/updated ACTIVE rate whose validity window overlaps an existing
   * ACTIVE rate for the same (vendor, rateType, target). Open-ended windows
   * (no `validTo`) are treated as extending to infinity.
   */
  private async assertNoOverlap(
    user: AuthenticatedUser,
    input: OverlapInput,
    excludeId?: string,
  ): Promise<void> {
    const criteria: FilterQuery<VendorRateDocument> = {
      vendorId: new Types.ObjectId(input.vendorId),
      rateType: input.rateType,
    };
    // Match the same target dimension (hotel > service > code > generic).
    if (input.hotelId) criteria.hotelId = new Types.ObjectId(input.hotelId);
    else if (input.serviceId) criteria.serviceId = new Types.ObjectId(input.serviceId);
    else if (input.serviceCode) criteria.serviceCode = input.serviceCode.toUpperCase();
    else {
      criteria.hotelId = { $exists: false };
      criteria.serviceId = { $exists: false };
    }

    const candidates = await this.rates.findActiveMatching(this.scope(user), criteria);
    const clash = candidates.find(
      (r) =>
        r.id !== excludeId &&
        this.windowsOverlap(input.validFrom, input.validTo, r.validFrom, r.validTo),
    );
    if (clash) {
      throw new EntityConflictException(
        `An overlapping ACTIVE rate already exists for this vendor/target and validity window (rate ${clash.id as string}).`,
      );
    }
  }

  private windowsOverlap(aFrom: Date, aTo: Date | undefined, bFrom: Date, bTo: Date | undefined): boolean {
    const aEnd = aTo?.getTime() ?? Number.POSITIVE_INFINITY;
    const bEnd = bTo?.getTime() ?? Number.POSITIVE_INFINITY;
    return aFrom.getTime() <= bEnd && bFrom.getTime() <= aEnd;
  }

  /** Resolve the caller's tenant, rejecting principals with no organization. */
  private orgId(user: AuthenticatedUser): Types.ObjectId {
    if (!user.organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    return new Types.ObjectId(user.organizationId);
  }

  /** Query-level tenant scope for the caller's organization. */
  private scope(user: AuthenticatedUser): FilterQuery<VendorRateDocument> {
    return { organizationId: this.orgId(user) };
  }
}
