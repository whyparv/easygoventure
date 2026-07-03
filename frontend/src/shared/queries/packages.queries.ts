import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ListParams } from '@shared/api/query-keys';
import { packagesService } from '@shared/services/packages.service';

export function usePackages(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.packages.list(params),
    queryFn: () => packagesService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function usePackage(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.packages.detail(id ?? ''),
    queryFn: () => packagesService.get(id as string),
    enabled: Boolean(id),
  });
}

export function usePackageItems(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.packages.items(id ?? ''),
    queryFn: () => packagesService.items(id as string),
    enabled: Boolean(id),
  });
}
