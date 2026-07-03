import { http } from '@shared/api/http';
import type { Proposal } from '@shared/types/domain';

export interface ReadinessResult {
  ready: boolean;
  issues: string[];
  checks: Record<string, boolean>;
}

export interface ProposalLineage {
  leadId: string | null;
  inquiryId: string | null;
  packageId: string | null;
  quotationId: string | null;
  quotationNumber: string | null;
  quotationVersion: number | null;
  proposalId: string;
}

/** Phase 2.1 commercial proposal operations (convert / readiness / book / lineage). */
export const proposalsOpsService = {
  convert: (quotationId: string) => http.post<Proposal>(`/proposals/convert/${quotationId}`),
  checkReadiness: (id: string) => http.post<ReadinessResult>(`/proposals/${id}/check-readiness`),
  book: (id: string) => http.post<{ proposal: Proposal; items: unknown[] }>(`/proposals/${id}/book`),
  lineage: (id: string) => http.get<ProposalLineage>(`/proposals/${id}/lineage`),
};
