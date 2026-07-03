import { Injectable } from '@nestjs/common';
import { FilterQuery, SortOrder, Types } from 'mongoose';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { VendorRatesService } from '../vendors/vendor-rates.service';
import { PackagesRepository } from './packages.repository';
import { PackageItemsRepository } from './package-items.repository';
import { PricingEngineService } from './pricing-engine.service';
import { Package, PackageDocument, PackageStatus } from './schemas/package.schema';
import { MarkupType, PackageItem, PackageItemDocument } from './schemas/package-item.schema';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { QueryPackageDto } from './dto/query-package.dto';
import { CreatePackageItemDto } from './dto/create-package-item.dto';
import { UpdatePackageItemDto } from './dto/update-package-item.dto';

@Injectable()
export class PackagesService {
  constructor(
    private readonly packages: PackagesRepository,
    private readonly items: PackageItemsRepository,
    private readonly pricing: PricingEngineService,
    private readonly vendorRates: VendorRatesService,
    private readonly audit: AuditService,
  ) {}

  // ── Package CRUD ─────────────────────────────────────────────────────────

  async create(dto: CreatePackageDto, user: AuthenticatedUser): Promise<PackageDocument> {
    const organizationId = this.orgId(user);
    const created = await this.packages.create({
      organizationId,
      inquiryId: dto.inquiryId ? new Types.ObjectId(dto.inquiryId) : null,
      name: dto.name,
      destination: dto.destination,
      travelStartDate: dto.travelStartDate ? new Date(dto.travelStartDate) : undefined,
      travelEndDate: dto.travelEndDate ? new Date(dto.travelEndDate) : undefined,
      numberOfTravelers: dto.numberOfTravelers ?? 1,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      status: PackageStatus.DRAFT,
    });
    await this.audit.recordForActor(user, undefined, {
      action: 'package.created',
      entity: 'Package',
      entityId: created.id as string,
      newValue: { name: created.name, inquiryId: dto.inquiryId },
    });
    return created;
  }

  async findAll(query: QueryPackageDto, user: AuthenticatedUser): Promise<PaginatedResponse<PackageDocument>> {
    const filter: FilterQuery<PackageDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.inquiryId && Types.ObjectId.isValid(query.inquiryId)) {
      filter.inquiryId = new Types.ObjectId(query.inquiryId);
    }
    const sort: Record<string, SortOrder> = { [query.sortBy ?? 'createdAt']: query.sortOrder };
    const { items, total } = await this.packages.paginateScoped(this.scope(user), filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, user: AuthenticatedUser): Promise<PackageDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const pkg = await this.packages.findByIdScoped(id, this.scope(user));
    if (!pkg) throw new NotFoundException(`Package "${id}" not found`, 'PACKAGE_NOT_FOUND');
    return pkg;
  }

  async update(id: string, dto: UpdatePackageDto, user: AuthenticatedUser): Promise<PackageDocument> {
    await this.findByIdOrThrow(id, user);
    const data: Partial<Package> = {
      name: dto.name,
      destination: dto.destination,
      travelStartDate: dto.travelStartDate ? new Date(dto.travelStartDate) : undefined,
      travelEndDate: dto.travelEndDate ? new Date(dto.travelEndDate) : undefined,
      numberOfTravelers: dto.numberOfTravelers,
      currency: dto.currency ? dto.currency.toUpperCase() : undefined,
      status: dto.status,
      notes: dto.notes,
    };
    const updated = await this.packages.updateScoped(id, data, this.scope(user));
    if (!updated) throw new NotFoundException(`Package "${id}" not found`, 'PACKAGE_NOT_FOUND');
    await this.audit.recordForActor(user, undefined, {
      action: 'package.updated',
      entity: 'Package',
      entityId: id,
      newValue: { status: updated.status, name: updated.name },
    });
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findByIdOrThrow(id, user);
    await this.packages.softDeleteScoped(id, this.scope(user));
    await this.audit.recordForActor(user, undefined, {
      action: 'package.deleted',
      entity: 'Package',
      entityId: id,
    });
  }

  /** Explicit recompute of package totals from its items. */
  async recalculate(id: string, user: AuthenticatedUser): Promise<PackageDocument> {
    await this.findByIdOrThrow(id, user);
    return this.refreshPackage(id, user);
  }

  // ── Package items ────────────────────────────────────────────────────────

  async listItems(packageId: string, user: AuthenticatedUser): Promise<PackageItemDocument[]> {
    const pkg = await this.findByIdOrThrow(packageId, user);
    return this.items.findByPackage(this.scope(user), new Types.ObjectId(pkg.id as string));
  }

  async addItem(
    packageId: string,
    dto: CreatePackageItemDto,
    user: AuthenticatedUser,
  ): Promise<PackageItemDocument> {
    const pkg = await this.assertMutablePackage(packageId, user);
    const organizationId = this.orgId(user);

    const { unitCost, vendorRateId } = await this.resolveCost(dto, user);
    const quantity = dto.quantity ?? 1;
    const markupType = dto.markupType ?? MarkupType.PERCENTAGE;
    const markupValue = dto.markupValue ?? 0;
    const priced = this.pricing.calculateItem({ unitCost, quantity, markupType, markupValue });

    const item = await this.items.create({
      organizationId,
      packageId: new Types.ObjectId(pkg.id as string),
      type: dto.type,
      referenceId: dto.referenceId ? new Types.ObjectId(dto.referenceId) : null,
      vendorRateId,
      description: dto.description,
      quantity,
      unitCost,
      markupType,
      markupValue,
      ...priced,
    });

    await this.refreshPackage(packageId, user);
    await this.audit.recordForActor(user, undefined, {
      action: 'package.item.added',
      entity: 'PackageItem',
      entityId: item.id as string,
      metadata: { packageId },
      newValue: { type: item.type, totalSellPrice: item.totalSellPrice },
    });
    return item;
  }

  async updateItem(
    packageId: string,
    itemId: string,
    dto: UpdatePackageItemDto,
    user: AuthenticatedUser,
  ): Promise<PackageItemDocument> {
    await this.assertMutablePackage(packageId, user);
    const existing = await this.findItemOrThrow(packageId, itemId, user);

    const { unitCost: resolvedCost, vendorRateId } = await this.resolveCost(dto, user);
    const unitCost = dto.unitCost ?? (dto.vendorRateId ? resolvedCost : existing.unitCost);
    const quantity = dto.quantity ?? existing.quantity;
    const markupType = dto.markupType ?? existing.markupType;
    const markupValue = dto.markupValue ?? existing.markupValue;
    const priced = this.pricing.calculateItem({ unitCost, quantity, markupType, markupValue });

    const data: Partial<PackageItem> = {
      description: dto.description,
      quantity,
      unitCost,
      markupType,
      markupValue,
      ...priced,
    };
    if (dto.referenceId !== undefined) {
      data.referenceId = dto.referenceId ? new Types.ObjectId(dto.referenceId) : null;
    }
    if (dto.vendorRateId !== undefined) data.vendorRateId = vendorRateId;

    const updated = await this.items.updateScoped(itemId, data, this.scope(user));
    if (!updated) throw new NotFoundException(`Package item "${itemId}" not found`, 'PACKAGE_ITEM_NOT_FOUND');

    await this.refreshPackage(packageId, user);
    await this.audit.recordForActor(user, undefined, {
      action: 'package.item.updated',
      entity: 'PackageItem',
      entityId: itemId,
      metadata: { packageId },
      newValue: { totalSellPrice: updated.totalSellPrice },
    });
    return updated;
  }

  async removeItem(packageId: string, itemId: string, user: AuthenticatedUser): Promise<void> {
    await this.assertMutablePackage(packageId, user);
    await this.findItemOrThrow(packageId, itemId, user);
    await this.items.softDeleteScoped(itemId, this.scope(user));
    await this.refreshPackage(packageId, user);
    await this.audit.recordForActor(user, undefined, {
      action: 'package.item.removed',
      entity: 'PackageItem',
      entityId: itemId,
      metadata: { packageId },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Recompute totals and auto-advance DRAFT → COSTED once the package has cost. */
  private async refreshPackage(packageId: string, user: AuthenticatedUser): Promise<PackageDocument> {
    const organizationId = this.orgId(user);
    const updated = await this.pricing.recalculatePackage(new Types.ObjectId(packageId), organizationId);
    if (!updated) throw new NotFoundException(`Package "${packageId}" not found`, 'PACKAGE_NOT_FOUND');
    if (updated.status === PackageStatus.DRAFT && updated.totalCost > 0) {
      const costed = await this.packages.updateScoped(
        packageId,
        { status: PackageStatus.COSTED },
        { organizationId },
      );
      return costed ?? updated;
    }
    return updated;
  }

  /**
   * A package can be re-costed until it is ARCHIVED. Re-costing a QUOTED package
   * is allowed (it does not alter existing quotations — those are immutable
   * snapshots — it just lets the consultant produce a new quotation version).
   */
  private async assertMutablePackage(packageId: string, user: AuthenticatedUser): Promise<PackageDocument> {
    const pkg = await this.findByIdOrThrow(packageId, user);
    if (pkg.status === PackageStatus.ARCHIVED) {
      throw new BusinessException('An archived package cannot be edited', 'PACKAGE_LOCKED');
    }
    return pkg;
  }

  private async findItemOrThrow(
    packageId: string,
    itemId: string,
    user: AuthenticatedUser,
  ): Promise<PackageItemDocument> {
    if (!Types.ObjectId.isValid(itemId)) {
      throw new ValidationException(`"${itemId}" is not a valid id`, 'INVALID_ID');
    }
    const item = await this.items.findByIdScoped(itemId, this.scope(user));
    if (!item || item.packageId.toString() !== packageId) {
      throw new NotFoundException(`Package item "${itemId}" not found`, 'PACKAGE_ITEM_NOT_FOUND');
    }
    return item;
  }

  /** Resolve the unit cost + vendorRate link from the DTO (rate netCost is the default cost). */
  private async resolveCost(
    dto: CreatePackageItemDto | UpdatePackageItemDto,
    user: AuthenticatedUser,
  ): Promise<{ unitCost: number; vendorRateId: Types.ObjectId | null }> {
    let vendorRateId: Types.ObjectId | null = null;
    let rateCost: number | undefined;
    if (dto.vendorRateId) {
      const rate = await this.vendorRates.findByIdOrThrow(dto.vendorRateId, user);
      vendorRateId = new Types.ObjectId(rate.id as string);
      rateCost = rate.netCost;
    }
    const unitCost = dto.unitCost ?? rateCost ?? 0;
    if (dto.unitCost === undefined && rateCost === undefined) {
      // Only enforce on create; update inherits the existing cost when both are absent.
      if (!('type' in dto)) {
        return { unitCost, vendorRateId };
      }
      throw new ValidationException(
        'Provide unitCost or vendorRateId to price this item',
        'UNIT_COST_REQUIRED',
      );
    }
    return { unitCost, vendorRateId };
  }

  private orgId(user: AuthenticatedUser): Types.ObjectId {
    if (!user.organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    return new Types.ObjectId(user.organizationId);
  }

  private scope(user: AuthenticatedUser): FilterQuery<PackageDocument> {
    return { organizationId: this.orgId(user) };
  }
}
