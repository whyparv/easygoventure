import { http } from '@shared/api/http';
import type { ListParams } from '@shared/api/query-keys';
import type { Paginated } from '@shared/types/api';
import type { Hotel, HotelRecommendations } from '@shared/types/ops-domain';

export interface RecommendParams {
  destination?: string;
  budget?: number;
  travelers?: number;
  nights?: number;
}

export const hotelsService = {
  list: (params: ListParams) => http.get<Paginated<Hotel>>('/hotels', params),
  get: (id: string) => http.get<Hotel>(`/hotels/${id}`),
  recommend: (params: RecommendParams) =>
    http.get<HotelRecommendations>('/hotels/recommendations', { ...params } as Record<string, unknown>),
};
