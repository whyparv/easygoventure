/** Mirrors the backend envelope `{ success, data, message, timestamp }`. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiErrorShape {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
  path: string;
  timestamp: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}
