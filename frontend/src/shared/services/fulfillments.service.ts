import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type { Fulfillment, FulfillmentStatus, FulfillmentType } from '@shared/types/domain';

export interface CreateFulfillmentInput {
  leadId: string;
  proposalId?: string;
  type: FulfillmentType;
  status?: FulfillmentStatus;
  remarks?: string;
  dueDate?: string;
}

export interface UpdateFulfillmentInput {
  status?: FulfillmentStatus;
  remarks?: string;
  dueDate?: string;
}

export const fulfillmentsService = {
  list: (params: ListParams) => http.get<Paginated<Fulfillment>>('/fulfillments', params),
  create: (input: CreateFulfillmentInput) => http.post<Fulfillment>('/fulfillments', input),
  update: (id: string, input: UpdateFulfillmentInput) =>
    http.patch<Fulfillment>(`/fulfillments/${id}`, input),
};
