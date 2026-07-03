import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys, type ListParams } from '@shared/api/query-keys';
import { hotelsService, type RecommendParams } from '@shared/services/hotels.service';

export function useHotels(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.hotels.list(params),
    queryFn: () => hotelsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useHotel(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hotels.detail(id ?? ''),
    queryFn: () => hotelsService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useHotelRecommendations(params: RecommendParams, enabled = true) {
  return useQuery({
    queryKey: ['hotels', 'recommendations', params] as const,
    queryFn: () => hotelsService.recommend(params),
    enabled,
  });
}
