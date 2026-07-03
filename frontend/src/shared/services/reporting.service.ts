import { http } from '@shared/api/http';
import type { RevenuePipeline } from '@shared/types/ops-domain';

export const reportingService = {
  revenuePipeline: () => http.get<RevenuePipeline>('/revenue-pipeline'),
};
