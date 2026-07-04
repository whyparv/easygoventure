import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ListParams } from '@shared/api/query-keys';
import { servicesService } from '@shared/services/services.service';

export function useServices(params: ListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.services.list(params),
    queryFn: () => servicesService.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useService(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.services.detail(id ?? ''),
    queryFn: () => servicesService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useServiceCategories() {
  return useQuery({
    queryKey: queryKeys.services.categories,
    queryFn: () => servicesService.categories(),
    staleTime: 5 * 60_000, // global reference data — rarely changes
  });
}
