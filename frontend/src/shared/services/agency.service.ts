import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type { Agency } from '@shared/types/domain';

export interface CreateAgencyInput {
  name: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  city?: string;
  country?: string;
  address?: string;
  website?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateAgencyInput = Partial<CreateAgencyInput>;

export interface FindOrCreateAgencyInput {
  name: string;
  phone?: string;
  email?: string;
}

export const agencyService = {
  search: (q: string, limit = 10) =>
    http.get<Paginated<Agency>>('/agencies', { search: q, limit }),
  findAll: (params: ListParams) => http.get<Paginated<Agency>>('/agencies', params),
  create: (input: CreateAgencyInput) => http.post<Agency>('/agencies', input),
  update: (id: string, input: UpdateAgencyInput) => http.patch<Agency>(`/agencies/${id}`, input),
  remove: (id: string) => http.delete<{ id: string }>(`/agencies/${id}`),
  findOrCreate: (input: FindOrCreateAgencyInput) =>
    http.post<Agency>('/agencies/find-or-create', input),
};
