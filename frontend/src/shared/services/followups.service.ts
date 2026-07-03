import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type { FollowUp, FollowUpOutcome } from '@shared/types/domain';

export interface CreateFollowUpInput {
  leadId: string;
  scheduledDate: string;
  remarks?: string;
  nextAction?: string;
}

export interface UpdateFollowUpInput {
  scheduledDate?: string;
  remarks?: string;
  outcome?: FollowUpOutcome;
  nextAction?: string;
}

export const followupsService = {
  list: (params: ListParams) => http.get<Paginated<FollowUp>>('/followups', params),
  create: (input: CreateFollowUpInput) => http.post<FollowUp>('/followups', input),
  update: (id: string, input: UpdateFollowUpInput) =>
    http.patch<FollowUp>(`/followups/${id}`, input),
};
