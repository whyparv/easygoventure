import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ListParams } from '@shared/api/query-keys';
import { fulfillmentsService } from '@shared/services/fulfillments.service';

export function useFulfillments(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.fulfillments.list(params),
    queryFn: () => fulfillmentsService.list(params),
    placeholderData: keepPreviousData,
  });
}
