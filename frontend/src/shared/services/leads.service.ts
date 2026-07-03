import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type {
  InquiryType,
  Lead,
  LeadActivity,
  LeadActivityType,
  LeadSource,
  LeadStatus,
} from '@shared/types/domain';

export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string;
  companyName?: string;
  source?: LeadSource;
  inquiryType: InquiryType;
  status?: LeadStatus;
  notes?: string;
  rawInquiry?: string;
}

export type UpdateLeadInput = Partial<CreateLeadInput>;

export interface CreateActivityInput {
  type: LeadActivityType;
  description: string;
  metadata?: Record<string, unknown>;
}

export const leadsService = {
  list: (params: ListParams) => http.get<Paginated<Lead>>('/leads', params),
  get: (id: string) => http.get<Lead>(`/leads/${id}`),
  create: (input: CreateLeadInput) => http.post<Lead>('/leads', input),
  update: (id: string, input: UpdateLeadInput) => http.patch<Lead>(`/leads/${id}`, input),
  remove: (id: string) => http.delete<{ id: string }>(`/leads/${id}`),
  activities: (id: string) => http.get<LeadActivity[]>(`/leads/${id}/activities`),
  addActivity: (id: string, input: CreateActivityInput) =>
    http.post<LeadActivity>(`/leads/${id}/activities`, input),
};
