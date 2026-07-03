/**
 * Validated access to Vite env. The dev server proxies `/api` → backend:8080,
 * so the default base hits `http://localhost:8080/api/v1` transparently.
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  apiKey: import.meta.env.VITE_API_KEY ?? '',
  appName: import.meta.env.VITE_APP_NAME ?? 'EasyGoVenture',
  isProd: import.meta.env.PROD,
  isDev: import.meta.env.DEV,
} as const;
