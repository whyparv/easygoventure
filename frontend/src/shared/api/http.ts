import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@app/config/env';
import { useAuthStore } from '@shared/stores/auth.store';
import type { ApiEnvelope, ApiErrorShape } from '@shared/types/api';
import type { AuthResult } from '@shared/types/auth';

/**
 * Normalised error thrown by all data hooks. UI reads `.message`, `.code`,
 * `.status`, and `.details` (field-level validation messages).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: string[];

  constructor(message: string, status: number, code: string, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const axiosInstance: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach the perimeter api-key (staging) + the user Bearer token ──
axiosInstance.interceptors.request.use((config) => {
  if (env.apiKey) config.headers['x-api-key'] = env.apiKey;
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Token refresh (single-flight) ────────────────────────────────────────────
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;
  try {
    // Raw call (no unwrap); the interceptor below skips /auth/refresh so this
    // can never recurse into itself.
    const res = await axiosInstance.post<ApiEnvelope<AuthResult>>('/auth/refresh', { refreshToken });
    const result = res.data.data;
    useAuthStore.getState().setSession(result);
    return result.accessToken;
  } catch {
    return null;
  }
}

// ── Response: on 401, refresh once and retry; on failure, force logout ───────
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      // Coalesce concurrent 401s onto a single refresh request.
      refreshPromise = refreshPromise ?? refreshAccessToken().finally(() => (refreshPromise = null));
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(original);
      }
      // Refresh failed → clear the session. Route guards react to the status
      // change and redirect to /login (no hard navigation, no loops).
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  },
);

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorShape>;
    const data = axiosError.response?.data;
    if (data && typeof data === 'object' && 'code' in data) {
      return new ApiError(data.message, data.statusCode, data.code, data.details);
    }
    if (axiosError.code === 'ERR_NETWORK') {
      return new ApiError('Cannot reach the server. Check your connection.', 0, 'NETWORK_ERROR');
    }
    return new ApiError(axiosError.message, axiosError.response?.status ?? 0, 'UNKNOWN');
  }
  return new ApiError('An unexpected error occurred', 0, 'UNKNOWN');
}

/** Unwrap the `{ success, data }` envelope and return `data`. */
async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const res = await promise;
    return res.data.data;
  } catch (error) {
    throw toApiError(error);
  }
}

export const http = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    unwrap<T>(axiosInstance.get<ApiEnvelope<T>>(url, { params })),
  post: <T>(url: string, body?: unknown) =>
    unwrap<T>(axiosInstance.post<ApiEnvelope<T>>(url, body)),
  patch: <T>(url: string, body?: unknown) =>
    unwrap<T>(axiosInstance.patch<ApiEnvelope<T>>(url, body)),
  put: <T>(url: string, body?: unknown) =>
    unwrap<T>(axiosInstance.put<ApiEnvelope<T>>(url, body)),
  delete: <T>(url: string) => unwrap<T>(axiosInstance.delete<ApiEnvelope<T>>(url)),
};
