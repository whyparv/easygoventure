import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ListParams } from '@shared/api/query-keys';
import { quotationsService } from '@shared/services/quotations.service';

export function useQuotations(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.quotations.list(params),
    queryFn: () => quotationsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useQuotation(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.quotations.detail(id ?? ''),
    queryFn: () => quotationsService.get(id as string),
    enabled: Boolean(id),
  });
}
