import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ListParams } from '@shared/api/query-keys';
import { inquiriesService } from '@shared/services/inquiries.service';

export function useInquiries(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.inquiries.list(params),
    queryFn: () => inquiriesService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useInquiry(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inquiries.detail(id ?? ''),
    queryFn: () => inquiriesService.get(id as string),
    enabled: Boolean(id),
  });
}
