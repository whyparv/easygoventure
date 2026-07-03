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
import { PackagesService } from '../packages/packages.service';
import { PackagesRepository } from '../packages/packages.repository';
import { PricingEngineService } from '../packages/pricing-engine.service';
import { PackageStatus } from '../packages/schemas/package.schema';
import { PackageItemDocument } from '../packages/schemas/package-item.schema';
import { VendorsService } from '../vendors/vendors.service';
import { VendorRatesService } from '../vendors/vendor-rates.service';
import { QuotationsRepository } from './quotations.repository';
import { QuotationNumberService } from './quotation-number.service';
import {
  PackageItemSnapshot,
  PackageSnapshot,
  Quotation,
  QuotationDocument,
  QuotationStatus,
  VendorRateSnapshot,
} from './schemas/quotation.schema';
import { GenerateQuotationDto } from './dto/generate-quotation.dto';
import { QueryQuotationDto } from './dto/query-quotation.dto';
import { RejectQuotationDto } from './dto/quotation-response.dto';

const MAX_NUMBER_ATTEMPTS = 5;
const DEFAULT_VALIDITY_DAYS = 14;

@Injectable()
export class QuotationsService {
  constructor(
    private readonly quotations: QuotationsRepository,
    private readonly numbers: QuotationNumberService,
    private readonly packagesService: PackagesService,
    private readonly packagesRepo: PackagesRepository,
    private readonly pricing: PricingEngineService,
    private readonly vendors: VendorsService,
    private readonly vendorRates: VendorRatesService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Generate a customer-facing quotation from a package. FREEZES the current
   * package + items + vendor rates into an immutable snapshot. Later edits to the
   * package or vendor rates never change this quotation.
   */
  async generateFromPackage(
    packageId: string,
    dto: GenerateQuotationDto,
    user: AuthenticatedUser,
  ): Promise<QuotationDocument> {
    const organizationId = this.orgId(user);
    const pkg = await this.packagesService.findByIdOrThrow(packageId, user);
    const items = await this.packagesService.listItems(packageId, user);
    if (items.length === 0) {
      throw new BusinessException('Cannot quote a package with no items', 'EMPTY_PACKAGE');
    }

    const snapshot = await this.buildSnapshot(pkg, items, user);
    const version = (await this.quotations.countByPackage({ organizationId }, new Types.ObjectId(pkg.id as string))) + 1;
    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : new Date(Date.now() + DEFAULT_VALIDITY_DAYS * 86_400_000);

    const quotation = await this.createWithUniqueNumber({
      organizationId,
      packageId: new Types.ObjectId(pkg.id as string),
      version,
      currency: pkg.currency,
      customerPrice: snapshot.totalSellPrice,
      validUntil,
      notes: dto.notes,
      status: QuotationStatus.DRAFT,
      snapshot,
    });

    // Mark the source package as QUOTED (does not freeze it — re-costing is allowed
    // and produces a new immutable version).
    await this.packagesRepo.updateScoped(pkg.id as string, { status: PackageStatus.QUOTED }, { organizationId });

    await this.audit.recordForActor(user, undefined, {
      action: 'quotation.generated',
      entity: 'Quotation',
      entityId: quotation.id as string,
      metadata: { packageId, version },
      newValue: { quotationNumber: quotation.quotationNumber, customerPrice: quotation.customerPrice },
    });
    return quotation;
  }

  async findAll(query: QueryQuotationDto, user: AuthenticatedUser): Promise<PaginatedResponse<QuotationDocument>> {
    const filter: FilterQuery<QuotationDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.packageId && Types.ObjectId.isValid(query.packageId)) {
      filter.packageId = new Types.ObjectId(query.packageId);
    }
    const sort: Record<string, SortOrder> = { [query.sortBy ?? 'createdAt']: query.sortOrder };
    const { items, total } = await this.quotations.paginateScoped(this.scope(user), filter, {
      skip: query.skip,
      limit: query.limit,
      sort,
    });
    return new PaginatedResponse(items, total, query.page, query.limit);
  }

  async findByIdOrThrow(id: string, user: AuthenticatedUser): Promise<QuotationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const quotation = await this.quotations.findByIdScoped(id, this.scope(user));
    if (!quotation) throw new NotFoundException(`Quotation "${id}" not found`, 'QUOTATION_NOT_FOUND');
    return quotation;
  }

  async send(id: string, user: AuthenticatedUser): Promise<QuotationDocument> {
    return this.transition(id, user, [QuotationStatus.DRAFT], QuotationStatus.SENT, {
      sentAt: new Date(),
    }, 'quotation.sent');
  }

  async accept(id: string, user: AuthenticatedUser): Promise<QuotationDocument> {
    // Contractual acceptance — records who accepted; the frozen snapshot makes the
    // accepted commercial terms immutable (no later rate/package edit can change them).
    return this.transition(id, user, [QuotationStatus.SENT], QuotationStatus.ACCEPTED, {
      acceptedAt: new Date(),
      acceptedBy: new Types.ObjectId(user.id),
    }, 'quotation.accepted');
  }

  /** Link an accepted quotation to the proposal it was converted into (single-use). */
  async markConverted(
    quotationId: string,
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.quotations.updateScoped(
      quotationId,
      { convertedProposalId: new Types.ObjectId(proposalId) },
      this.scope(user),
    );
  }

  async reject(id: string, dto: RejectQuotationDto, user: AuthenticatedUser): Promise<QuotationDocument> {
    return this.transition(
      id,
      user,
      [QuotationStatus.DRAFT, QuotationStatus.SENT],
      QuotationStatus.REJECTED,
      { rejectedAt: new Date() },
      'quotation.rejected',
      dto.reason,
    );
  }

  // ── Snapshot construction (immutable freeze) ────────────────────────────

  private async buildSnapshot(
    pkg: Awaited<ReturnType<PackagesService['findByIdOrThrow']>>,
    items: PackageItemDocument[],
    user: AuthenticatedUser,
  ): Promise<PackageSnapshot> {
    const itemSnapshots: PackageItemSnapshot[] = [];
    for (const item of items) {
      itemSnapshots.push({
        itemId: item.id as string,
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unitCost: item.unitCost,
        unitSellPrice: item.unitSellPrice,
        markupType: item.markupType,
        markupValue: item.markupValue,
        totalCost: item.totalCost,
        totalSellPrice: item.totalSellPrice,
        profit: item.profit,
        vendorRate: await this.snapshotVendorRate(item, user),
      });
    }

    // Totals are recomputed from the (frozen) items so the snapshot is internally consistent.
    const totals = this.pricing.calculatePackage(items);
    return {
      packageId: pkg.id as string,
      name: pkg.name,
      destination: pkg.destination,
      travelStartDate: pkg.travelStartDate,
      travelEndDate: pkg.travelEndDate,
      numberOfTravelers: pkg.numberOfTravelers,
      currency: pkg.currency,
      totalCost: totals.totalCost,
      totalMarkup: totals.totalMarkup,
      totalSellPrice: totals.totalSellPrice,
      expectedProfit: totals.expectedProfit,
      items: itemSnapshots,
    };
  }

  private async snapshotVendorRate(
    item: PackageItemDocument,
    user: AuthenticatedUser,
  ): Promise<VendorRateSnapshot | null> {
    if (!item.vendorRateId) return null;
    let rate: Awaited<ReturnType<VendorRatesService['findByIdOrThrow']>>;
    try {
      rate = await this.vendorRates.findByIdOrThrow(item.vendorRateId.toString(), user);
    } catch {
      return null; // rate since deleted — leave the item snapshot without a rate.
    }
    let vendorName: string | undefined;
    try {
      const vendor = await this.vendors.findByIdOrThrow(rate.vendorId.toString(), user);
      vendorName = vendor.name;
    } catch {
      vendorName = undefined;
    }
    return {
      vendorRateId: rate.id as string,
      vendorId: rate.vendorId.toString(),
      vendorName,
      rateType: rate.rateType,
      currency: rate.currency,
      netCost: rate.netCost,
      validFrom: rate.validFrom,
      validTo: rate.validTo,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async transition(
    id: string,
    user: AuthenticatedUser,
    from: QuotationStatus[],
    to: QuotationStatus,
    extra: Partial<Quotation>,
    action: string,
    reason?: string,
  ): Promise<QuotationDocument> {
    const quotation = await this.findByIdOrThrow(id, user);
    if (!from.includes(quotation.status)) {
      throw new BusinessException(
        `Cannot ${to.toLowerCase()} a quotation while it is ${quotation.status}`,
        'INVALID_QUOTATION_TRANSITION',
      );
    }
    const updated = await this.quotations.updateScoped(id, { status: to, ...extra }, this.scope(user));
    if (!updated) throw new NotFoundException(`Quotation "${id}" not found`, 'QUOTATION_NOT_FOUND');
    await this.audit.recordForActor(user, undefined, {
      action,
      entity: 'Quotation',
      entityId: id,
      oldValue: { status: quotation.status },
      newValue: { status: to, ...(reason ? { reason } : {}) },
    });
    return updated;
  }

  private async createWithUniqueNumber(base: Partial<Quotation>): Promise<QuotationDocument> {
    for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt += 1) {
      try {
        return await this.quotations.create({ ...base, quotationNumber: this.numbers.generate() });
      } catch (error) {
        if (this.isDuplicateKeyError(error) && attempt < MAX_NUMBER_ATTEMPTS - 1) continue;
        throw error;
      }
    }
    throw new BusinessException('Could not allocate a unique quotation number', 'NUMBER_ALLOCATION');
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private orgId(user: AuthenticatedUser): Types.ObjectId {
    if (!user.organizationId) {
      throw new BusinessException('An organization context is required', 'ORGANIZATION_REQUIRED');
    }
    return new Types.ObjectId(user.organizationId);
  }

  private scope(user: AuthenticatedUser): FilterQuery<QuotationDocument> {
    return { organizationId: this.orgId(user) };
  }
}
