import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type { Service, ServiceCategory } from '@shared/types/domain';

export interface CreateServiceInput {
  categoryCode: string;
  name: string;
  code?: string;
  destination?: string;
  serviceType?: string;
  variantGroup?: string;
  description?: string;
  supplier?: string;
  currency?: string;
  basePrice?: number;
  costPrice?: number;
  defaultSellPrice?: number;
  isActive?: boolean;
}

export type UpdateServiceInput = Partial<CreateServiceInput>;

export interface ServiceSearchParams {
  search?: string;
  destination?: string;
  categoryCode?: string;
  limit?: number;
}

export const servicesService = {
  list: (params: ListParams) => http.get<Paginated<Service>>('/services', params),
  search: (params: ServiceSearchParams) =>
    http.get<Paginated<Service>>('/services', { ...params, isActive: 'true' } as Record<string, unknown>),
  get: (id: string) => http.get<Service>(`/services/${id}`),
  create: (input: CreateServiceInput) => http.post<Service>('/services', input),
  update: (id: string, input: UpdateServiceInput) => http.patch<Service>(`/services/${id}`, input),
  remove: (id: string) => http.delete<{ id: string }>(`/services/${id}`),
  categories: () => http.get<ServiceCategory[]>('/service-categories'),
};
