import { z } from 'zod';

/**
 * Single source of truth for runtime environment validation.
 * The app refuses to boot when required variables are missing or malformed.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  API_PREFIX: z.string().default('api'),

  // CORS — comma-separated list of allowed origins
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  // Database (MongoDB)
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().default('dmc_crm'),

  // AI provider (Groq). AI endpoints are disabled when GROQ_API_KEY is unset.
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('qwen/qwen3.6-27b'),
  // Reasoning models (e.g. Qwen3) "think" before answering, which burns the token
  // budget and breaks JSON mode. Default 'none' disables it — best for our short
  // extraction/copy tasks. Use 'auto' to omit the param for non-reasoning models.
  GROQ_REASONING_EFFORT: z
    .enum(['none', 'default', 'low', 'medium', 'high', 'auto'])
    .default('none'),

  // API gate — when set, all routes (except /health) require the x-api-key header.
  // Leave empty to disable the gate for local development.
  API_KEY: z.string().optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.coerce.boolean().default(false),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  // Auth policy — account lockout & password reset
  AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().positive().default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  AUTH_RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  // Rate limiting
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  // Observability
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SWAGGER_ENABLED: z.coerce.boolean().default(true),
});

export type EnvVars = z.infer<typeof envSchema>;

/**
 * NestJS ConfigModule validate hook.
 */
export function validateEnv(config: Record<string, unknown>): EnvVars {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`❌ Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
