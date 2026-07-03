import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type { Inquiry, InquirySource, InquiryStatus } from '@shared/types/ops-domain';

export interface CreateInquiryInput {
  customerName: string;
  source?: InquirySource;
  customerPhone?: string;
  customerEmail?: string;
  companyName?: string;
  destination?: string;
  serviceCategoryCode?: string;
  travelers?: number;
  travelDate?: string;
  budget?: number;
  rawInquiry?: string;
  notes?: string;
}
export type UpdateInquiryInput = Partial<CreateInquiryInput>;

export const inquiriesService = {
  list: (params: ListParams) => http.get<Paginated<Inquiry>>('/inquiries', params),
  get: (id: string) => http.get<Inquiry>(`/inquiries/${id}`),
  create: (input: CreateInquiryInput) => http.post<Inquiry>('/inquiries', input),
  update: (id: string, input: UpdateInquiryInput) => http.patch<Inquiry>(`/inquiries/${id}`, input),
  transition: (id: string, status: InquiryStatus) =>
    http.post<Inquiry>(`/inquiries/${id}/transition`, { status }),
  convert: (id: string) => http.post<{ inquiry: Inquiry; leadId: string }>(`/inquiries/${id}/convert`),
};
