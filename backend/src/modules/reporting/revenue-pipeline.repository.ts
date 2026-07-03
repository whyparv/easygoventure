import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Inquiry, InquiryDocument } from '../inquiries/schemas/inquiry.schema';
import { Package, PackageDocument } from '../packages/schemas/package.schema';
import { Quotation, QuotationDocument, QuotationStatus } from '../quotations/schemas/quotation.schema';
import { Proposal, ProposalBookingStatus, ProposalDocument } from '../proposals/schemas/proposal.schema';
import {
  FulfillmentItem,
  FulfillmentItemDocument,
  FulfillmentItemStatus,
} from '../proposals/schemas/fulfillment-item.schema';

/** A tenant scope fragment ({} for a super-admin cross-org roll-up). */
export type Scope = FilterQuery<Record<string, unknown>>;

interface SumResult {
  revenue?: number;
  profit?: number;
}

@Injectable()
export class RevenuePipelineRepository {
  constructor(
    @InjectModel(Inquiry.name) private readonly inquiries: Model<InquiryDocument>,
    @InjectModel(Package.name) private readonly packages: Model<PackageDocument>,
    @InjectModel(Quotation.name) private readonly quotations: Model<QuotationDocument>,
    @InjectModel(Proposal.name) private readonly proposals: Model<ProposalDocument>,
    @InjectModel(FulfillmentItem.name) private readonly fulfillmentItems: Model<FulfillmentItemDocument>,
  ) {}

  private live<T>(scope: Scope, extra: FilterQuery<T> = {}): FilterQuery<T> {
    return { ...scope, ...extra, isDeleted: { $ne: true } };
  }

  countInquiries(scope: Scope): Promise<number> {
    return this.inquiries.countDocuments(this.live(scope)).exec();
  }

  countPackages(scope: Scope): Promise<number> {
    return this.packages.countDocuments(this.live(scope)).exec();
  }

  countProposals(scope: Scope): Promise<number> {
    return this.proposals.countDocuments(this.live(scope)).exec();
  }

  async quotationStats(
    scope: Scope,
  ): Promise<{ total: number; sent: number; accepted: number; rejected: number }> {
    const [total, sent, accepted, rejected] = await Promise.all([
      this.quotations.countDocuments(this.live(scope)).exec(),
      this.quotations.countDocuments(this.live(scope, { sentAt: { $ne: null } })).exec(),
      this.quotations.countDocuments(this.live(scope, { status: QuotationStatus.ACCEPTED })).exec(),
      this.quotations.countDocuments(this.live(scope, { status: QuotationStatus.REJECTED })).exec(),
    ]);
    return { total, sent, accepted, rejected };
  }

  /** Contractual (accepted) revenue + profit from the frozen quotation snapshots. */
  async acceptedRevenue(scope: Scope): Promise<{ revenue: number; profit: number }> {
    const rows = await this.quotations
      .aggregate<SumResult>([
        { $match: this.live(scope, { status: QuotationStatus.ACCEPTED }) },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$customerPrice' },
            profit: { $sum: '$snapshot.expectedProfit' },
          },
        },
      ])
      .exec();
    return { revenue: rows[0]?.revenue ?? 0, profit: rows[0]?.profit ?? 0 };
  }

  /** Open pipeline value — sent but not yet accepted/rejected. */
  async pipelineRevenue(scope: Scope): Promise<number> {
    const rows = await this.quotations
      .aggregate<SumResult>([
        { $match: this.live(scope, { status: QuotationStatus.SENT }) },
        { $group: { _id: null, revenue: { $sum: '$customerPrice' } } },
      ])
      .exec();
    return rows[0]?.revenue ?? 0;
  }

  async fulfillmentStats(scope: Scope): Promise<Record<string, number>> {
    const statuses = Object.values(FulfillmentItemStatus);
    const counts = await Promise.all(
      statuses.map((s) => this.fulfillmentItems.countDocuments(this.live(scope, { status: s })).exec()),
    );
    const total = await this.fulfillmentItems.countDocuments(this.live(scope)).exec();
    const out: Record<string, number> = { total };
    statuses.forEach((s, i) => (out[s] = counts[i]));
    return out;
  }

  async proposalBookingStats(scope: Scope): Promise<Record<string, number>> {
    const statuses = Object.values(ProposalBookingStatus);
    const counts = await Promise.all(
      statuses.map((s) => this.proposals.countDocuments(this.live(scope, { bookingStatus: s })).exec()),
    );
    const out: Record<string, number> = {};
    statuses.forEach((s, i) => (out[s] = counts[i]));
    return out;
  }
}
