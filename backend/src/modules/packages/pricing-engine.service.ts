import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { PackagesRepository } from './packages.repository';
import { PackageItemsRepository } from './package-items.repository';
import { PackageDocument } from './schemas/package.schema';
import { MarkupType } from './schemas/package-item.schema';

export interface ItemPricingInput {
  unitCost: number;
  quantity: number;
  markupType: MarkupType;
  markupValue: number;
}

export interface ItemPricingResult {
  unitSellPrice: number;
  totalCost: number;
  totalSellPrice: number;
  profit: number;
}

export interface PackageTotals {
  totalCost: number;
  totalMarkup: number;
  totalSellPrice: number;
  expectedProfit: number;
}

/**
 * PricingEngineService — the single source of truth for commercial math.
 *
 * All item and package figures are DERIVED here; nothing is entered manually.
 *
 *   Percentage markup: sellPrice = cost + (cost * markupValue / 100)
 *   Fixed markup:      sellPrice = cost + markupValue
 *   Profit:            sellPrice - cost
 *   Package totals:    sum over items
 *
 * Money is rounded to 2 decimal places to avoid floating-point drift.
 */
@Injectable()
export class PricingEngineService {
  constructor(
    private readonly packages: PackagesRepository,
    private readonly items: PackageItemsRepository,
  ) {}

  /** Compute a single item's derived prices. */
  calculateItem(input: ItemPricingInput): ItemPricingResult {
    const quantity = input.quantity > 0 ? input.quantity : 1;
    const unitCost = this.nonNegative(input.unitCost);
    const markupValue = this.nonNegative(input.markupValue);

    const unitSellPrice =
      input.markupType === MarkupType.FIXED
        ? this.round2(unitCost + markupValue)
        : this.round2(unitCost + (unitCost * markupValue) / 100);

    const totalCost = this.round2(unitCost * quantity);
    const totalSellPrice = this.round2(unitSellPrice * quantity);
    const profit = this.round2(totalSellPrice - totalCost);
    return { unitSellPrice, totalCost, totalSellPrice, profit };
  }

  /** Aggregate item totals into package totals. */
  calculatePackage(itemTotals: Array<{ totalCost: number; totalSellPrice: number }>): PackageTotals {
    let totalCost = 0;
    let totalSellPrice = 0;
    for (const item of itemTotals) {
      totalCost += item.totalCost;
      totalSellPrice += item.totalSellPrice;
    }
    totalCost = this.round2(totalCost);
    totalSellPrice = this.round2(totalSellPrice);
    const derived = this.round2(totalSellPrice - totalCost);
    // totalMarkup and expectedProfit are the same figure (sell − cost) framed two ways.
    return { totalCost, totalMarkup: derived, totalSellPrice, expectedProfit: derived };
  }

  /**
   * Recompute a package's totals from its current items and persist them. Called
   * after any item change. Tenant-scoped by `organizationId`. Returns the updated
   * package (or null if the package is not in the given organization).
   */
  async recalculatePackage(
    packageId: Types.ObjectId,
    organizationId: Types.ObjectId,
  ): Promise<PackageDocument | null> {
    const items = await this.items.findByPackage({ organizationId }, packageId);
    const totals = this.calculatePackage(items);
    return this.packages.updateScoped(packageId.toString(), totals, { organizationId });
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private nonNegative(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
}
