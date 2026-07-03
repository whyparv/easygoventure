import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type { Quotation } from '@shared/types/ops-domain';

export interface CreateQuotationInput {
  customerPrice?: number;
  validUntil?: string;
  notes?: string;
}

export const quotationsService = {
  list: (params: ListParams) => http.get<Paginated<Quotation>>('/quotations', params),
  get: (id: string) => http.get<Quotation>(`/quotations/${id}`),
  fromPackage: (packageId: string, input: CreateQuotationInput) =>
    http.post<Quotation>(`/quotations/from-package/${packageId}`, input),
  send: (id: string) => http.post<Quotation>(`/quotations/${id}/send`),
  accept: (id: string) => http.post<Quotation>(`/quotations/${id}/accept`),
  reject: (id: string, reason?: string) => http.post<Quotation>(`/quotations/${id}/reject`, { reason }),
};
