import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ListParams } from '@shared/api/query-keys';
import { followupsService } from '@shared/services/followups.service';

export function useFollowups(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.followups.list(params),
    queryFn: () => followupsService.list(params),
    placeholderData: keepPreviousData,
  });
}
