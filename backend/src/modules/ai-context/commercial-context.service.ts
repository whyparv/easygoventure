import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { InquiriesService } from '../inquiries/inquiries.service';
import { PackagesService } from '../packages/packages.service';
import { QuotationsService } from '../quotations/quotations.service';
import { VendorRatesService } from '../vendors/vendor-rates.service';

/**
 * A structured, tenant-safe context bundle for grounding an AI workflow. `summary`
 * is a compact human-readable brief (suitable to pass to the existing /ai/chat as
 * `context`); `data` is the structured payload for future tool-calling.
 */
export interface CommercialContext {
  type: 'inquiry' | 'package' | 'quotation' | 'proposal';
  summary: string;
  data: Record<string, unknown>;
}

/**
 * CommercialContextService — AI INFRASTRUCTURE ONLY.
 *
 * It assembles read-only commercial context (inquiry, package + items, vendor
 * rates, margin, quotation snapshot) for future AI workflows. It performs no
 * pricing, no writes, no approvals — human approval remains mandatory and the
 * existing AI behavior is unchanged.
 */
@Injectable()
export class CommercialContextService {
  constructor(
    private readonly inquiries: InquiriesService,
    private readonly packages: PackagesService,
    private readonly quotations: QuotationsService,
    private readonly vendorRates: VendorRatesService,
  ) {}

  async forInquiry(inquiryId: string, user: AuthenticatedUser): Promise<CommercialContext> {
    const inquiry = await this.inquiries.findByIdOrThrow(inquiryId, user);
    const data = {
      referenceNo: inquiry.referenceNo,
      status: inquiry.status,
      customerName: inquiry.customerName,
      companyName: inquiry.companyName,
      destination: inquiry.destination,
      serviceCategoryCode: inquiry.serviceCategoryCode,
      travelers: inquiry.travelers,
      travelDate: inquiry.travelDate,
      budget: inquiry.budget,
      notes: inquiry.notes,
    };
    const summary =
      `Inquiry ${inquiry.referenceNo} (${inquiry.status}) — ${inquiry.customerName}` +
      `${inquiry.destination ? ` to ${inquiry.destination}` : ''}` +
      `${inquiry.travelers ? `, ${inquiry.travelers} pax` : ''}` +
      `${inquiry.budget ? `, budget ${inquiry.budget}` : ''}.`;
    return { type: 'inquiry', summary, data };
  }

  async forPackage(packageId: string, user: AuthenticatedUser): Promise<CommercialContext> {
    const pkg = await this.packages.findByIdOrThrow(packageId, user);
    const items = await this.packages.listItems(packageId, user);

    const lines: Array<Record<string, unknown>> = [];
    for (const item of items) {
      const rate = await this.resolveRate(item.vendorRateId?.toString(), user);
      lines.push({
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
        vendorRate: rate,
      });
    }

    const marginPercent =
      pkg.totalSellPrice > 0 ? this.round1((pkg.totalMarkup / pkg.totalSellPrice) * 100) : 0;

    const data = {
      name: pkg.name,
      status: pkg.status,
      destination: pkg.destination,
      numberOfTravelers: pkg.numberOfTravelers,
      currency: pkg.currency,
      totals: {
        totalCost: pkg.totalCost,
        totalMarkup: pkg.totalMarkup,
        totalSellPrice: pkg.totalSellPrice,
        expectedProfit: pkg.expectedProfit,
        marginPercent,
      },
      items: lines,
    };
    const summary =
      `Package "${pkg.name}" (${pkg.status}) — ${items.length} item(s), ` +
      `cost ${pkg.currency} ${pkg.totalCost}, sell ${pkg.currency} ${pkg.totalSellPrice}, ` +
      `expected profit ${pkg.currency} ${pkg.expectedProfit} (${marginPercent}% margin).`;
    return { type: 'package', summary, data };
  }

  async forQuotation(quotationId: string, user: AuthenticatedUser): Promise<CommercialContext> {
    const quotation = await this.quotations.findByIdOrThrow(quotationId, user);
    const data = {
      quotationNumber: quotation.quotationNumber,
      version: quotation.version,
      status: quotation.status,
      currency: quotation.currency,
      customerPrice: quotation.customerPrice,
      validUntil: quotation.validUntil,
      snapshot: quotation.snapshot,
    };
    const summary =
      `Quotation ${quotation.quotationNumber} v${quotation.version} (${quotation.status}) — ` +
      `customer price ${quotation.currency} ${quotation.customerPrice}, ` +
      `expected profit ${quotation.currency} ${quotation.snapshot.expectedProfit}.`;
    return { type: 'quotation', summary, data };
  }

  private async resolveRate(
    vendorRateId: string | undefined,
    user: AuthenticatedUser,
  ): Promise<Record<string, unknown> | null> {
    if (!vendorRateId) return null;
    try {
      const rate = await this.vendorRates.findByIdOrThrow(vendorRateId, user);
      return {
        vendorRateId: rate.id as string,
        rateType: rate.rateType,
        currency: rate.currency,
        netCost: rate.netCost,
        validFrom: rate.validFrom,
        validTo: rate.validTo,
        status: rate.status,
      };
    } catch {
      return null;
    }
  }

  private round1(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
