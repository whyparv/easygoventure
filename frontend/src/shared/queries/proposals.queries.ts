import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ListParams } from '@shared/api/query-keys';
import { proposalsService } from '@shared/services/proposals.service';

export function useProposals(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.proposals.list(params),
    queryFn: () => proposalsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.proposals.detail(id ?? ''),
    queryFn: () => proposalsService.get(id as string),
    enabled: Boolean(id),
  });
}
