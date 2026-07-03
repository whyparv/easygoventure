import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ListParams } from '@shared/api/query-keys';
import { leadsService } from '@shared/services/leads.service';

export function useLeads(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.leads.list(params),
    queryFn: () => leadsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leads.detail(id ?? ''),
    queryFn: () => leadsService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useLeadActivities(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leads.activities(id ?? ''),
    queryFn: () => leadsService.activities(id as string),
    enabled: Boolean(id),
  });
}
