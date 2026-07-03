import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CommercialProposalsService } from '../proposals/commercial-proposals.service';
import { QuotationsService } from '../quotations/quotations.service';
import { CommercialContext } from './commercial-context.service';

/**
 * SalesContextProvider — AI INFRASTRUCTURE ONLY. Read-only assembly of the
 * post-acceptance sales picture (quotation acceptance, proposal readiness,
 * fulfillment progress, commercial lineage) for future AI workflows. No
 * conversion, no acceptance, no writes — human approval remains mandatory.
 */
@Injectable()
export class SalesContextService {
  constructor(
    private readonly commercial: CommercialProposalsService,
    private readonly quotations: QuotationsService,
  ) {}

  async forProposal(proposalId: string, user: AuthenticatedUser): Promise<CommercialContext> {
    const proposal = await this.commercial.getProposalOrThrow(proposalId, user);
    const lineage = await this.commercial.getLineage(proposalId, user);
    const readiness = await this.commercial.evaluateReadiness(proposalId, user);
    const items = await this.commercial.listFulfillmentItems(proposalId, user);

    const byStatus: Record<string, number> = {};
    for (const item of items) byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;

    let quotationAcceptance: Record<string, unknown> | null = null;
    if (proposal.quotationId) {
      try {
        const q = await this.quotations.findByIdOrThrow(proposal.quotationId.toString(), user);
        quotationAcceptance = {
          quotationNumber: q.quotationNumber,
          version: q.version,
          status: q.status,
          customerPrice: q.customerPrice,
          acceptedAt: q.acceptedAt,
          acceptedBy: q.acceptedBy?.toString() ?? null,
        };
      } catch {
        quotationAcceptance = null;
      }
    }

    const data = {
      lineage,
      status: proposal.status,
      bookingStatus: proposal.bookingStatus,
      acceptedPrice: proposal.acceptedPrice,
      currency: proposal.currency,
      readiness,
      quotationAcceptance,
      fulfillment: { total: items.length, byStatus },
    };

    const summary =
      `Proposal ${proposal.generatedToken} (booking: ${proposal.bookingStatus}) — ` +
      `accepted price ${proposal.currency} ${proposal.acceptedPrice ?? proposal.amount}, ` +
      `${readiness.ready ? 'ready for booking' : `not ready (${readiness.issues.length} issue(s))`}, ` +
      `${items.length} fulfillment item(s).`;
    return { type: 'proposal', summary, data };
  }
}
