import { Injectable } from '@nestjs/common';
import { tenantFilter } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { RevenuePipelineRepository, Scope } from './revenue-pipeline.repository';

export interface RevenuePipelineMetrics {
  inquiries: number;
  packagesCreated: number;
  proposals: number;
  quotations: { total: number; sent: number; accepted: number; rejected: number };
  conversionRate: number;
  expectedRevenue: number;
  expectedProfit: number;
  pipelineRevenue: number;
  fulfillment: Record<string, number>;
  proposalsByBookingStatus: Record<string, number>;
  generatedAt: string;
}

/**
 * RevenuePipelineService — tenant-scoped commercial pipeline metrics. Read-only
 * roll-up across inquiries, packages, quotations, proposals and fulfillment items.
 */
@Injectable()
export class RevenuePipelineService {
  constructor(
    private readonly repo: RevenuePipelineRepository,
    private readonly audit: AuditService,
  ) {}

  async getPipeline(user: AuthenticatedUser): Promise<RevenuePipelineMetrics> {
    // super-admin → platform-wide roll-up; everyone else → their organization.
    const scope = tenantFilter<Record<string, unknown>>(user) as Scope;

    const [inquiries, packagesCreated, proposals, quotations, accepted, pipelineRevenue, fulfillment, byBooking] =
      await Promise.all([
        this.repo.countInquiries(scope),
        this.repo.countPackages(scope),
        this.repo.countProposals(scope),
        this.repo.quotationStats(scope),
        this.repo.acceptedRevenue(scope),
        this.repo.pipelineRevenue(scope),
        this.repo.fulfillmentStats(scope),
        this.repo.proposalBookingStats(scope),
      ]);

    const conversionRate =
      quotations.sent > 0 ? this.round1((quotations.accepted / quotations.sent) * 100) : 0;
    const deliveredPercent =
      fulfillment.total > 0 ? this.round1(((fulfillment.DELIVERED ?? 0) / fulfillment.total) * 100) : 0;

    const metrics: RevenuePipelineMetrics = {
      inquiries,
      packagesCreated,
      proposals,
      quotations,
      conversionRate,
      expectedRevenue: this.round2(accepted.revenue),
      expectedProfit: this.round2(accepted.profit),
      pipelineRevenue: this.round2(pipelineRevenue),
      fulfillment: { ...fulfillment, deliveredPercent },
      proposalsByBookingStatus: byBooking,
      generatedAt: new Date().toISOString(),
    };

    await this.audit.recordForActor(user, undefined, {
      action: 'report.revenue_pipeline',
      entity: 'Report',
      metadata: {
        inquiries,
        quotationsAccepted: quotations.accepted,
        expectedRevenue: metrics.expectedRevenue,
      },
    });
    return metrics;
  }

  private round1(v: number): number {
    return Math.round(v * 10) / 10;
  }

  private round2(v: number): number {
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }
}
