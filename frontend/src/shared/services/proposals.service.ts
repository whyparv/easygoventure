import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type { AcceptProposalResult, Proposal, ProposalType } from '@shared/types/domain';

export interface CreateProposalInput {
  leadId: string;
  title: string;
  description?: string;
  proposalType: ProposalType;
  amount?: number;
  currency?: string;
  expiresAt?: string;
  notes?: string;
}

export const proposalsService = {
  list: (params: ListParams) => http.get<Paginated<Proposal>>('/proposals', params),
  get: (id: string) => http.get<Proposal>(`/proposals/${id}`),
  create: (input: CreateProposalInput) => http.post<Proposal>('/proposals', input),
  update: (id: string, input: Partial<CreateProposalInput>) =>
    http.patch<Proposal>(`/proposals/${id}`, input),
  send: (id: string) => http.post<Proposal>(`/proposals/${id}/send`),
  accept: (id: string) => http.post<AcceptProposalResult>(`/proposals/${id}/accept`),
  reject: (id: string, reason?: string) =>
    http.post<Proposal>(`/proposals/${id}/reject`, { reason }),
};
