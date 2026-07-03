import { registerAs } from '@nestjs/config';
import type { EnvVars } from './env.validation';

/**
 * Strongly-typed configuration namespaces.
 * Inject with `ConfigService` + the namespace key, e.g.
 *   configService.get('jwt.accessSecret')
 */
const env = process.env as unknown as EnvVars;

export const appConfig = registerAs('app', () => ({
  env: env.NODE_ENV,
  port: Number(env.PORT),
  apiPrefix: env.API_PREFIX,
  allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  logLevel: env.LOG_LEVEL,
  swaggerEnabled: env.SWAGGER_ENABLED,
}));

export const databaseConfig = registerAs('database', () => ({
  uri: env.MONGODB_URI,
  dbName: env.MONGODB_DB_NAME,
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: env.JWT_ACCESS_SECRET,
  accessTtl: env.JWT_ACCESS_TTL,
  refreshSecret: env.JWT_REFRESH_SECRET,
  refreshTtl: env.JWT_REFRESH_TTL,
}));

export const authConfig = registerAs('auth', () => ({
  maxFailedLogins: Number(env.AUTH_MAX_FAILED_LOGINS),
  lockoutMinutes: Number(env.AUTH_LOCKOUT_MINUTES),
  refreshTtlDays: Number(env.AUTH_REFRESH_TTL_DAYS),
  resetTokenTtlMinutes: Number(env.AUTH_RESET_TOKEN_TTL_MINUTES),
}));

export const redisConfig = registerAs('redis', () => ({
  host: env.REDIS_HOST,
  port: Number(env.REDIS_PORT),
  password: env.REDIS_PASSWORD,
  tls: env.REDIS_TLS,
}));

export const throttleConfig = registerAs('throttle', () => ({
  ttl: Number(env.THROTTLE_TTL),
  limit: Number(env.THROTTLE_LIMIT),
}));

export const aiConfig = registerAs('ai', () => ({
  groqApiKey: env.GROQ_API_KEY,
  groqModel: env.GROQ_MODEL,
  groqReasoningEffort: env.GROQ_REASONING_EFFORT,
}));

export const configurations = [
  appConfig,
  databaseConfig,
  jwtConfig,
  authConfig,
  redisConfig,
  throttleConfig,
  aiConfig,
];
