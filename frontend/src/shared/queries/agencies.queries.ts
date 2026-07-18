import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ListParams } from '@shared/api/query-keys';
import { agencyService } from '@shared/services/agency.service';

export function useAgencies(params: ListParams = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agencies.list(params),
    queryFn: () => agencyService.findAll(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAgencySearch(q: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agencies.search(q),
    queryFn: () => agencyService.search(q),
    enabled: enabled && q.length > 0,
  });
}
