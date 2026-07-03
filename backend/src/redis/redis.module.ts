import { Global, Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

/**
 * Provides a single shared ioredis connection across the app.
 * The connection options are also reused by the BullMQ queues.
 */
export function buildRedisOptions(config: ConfigService): RedisOptions {
  const redis = config.get('redis') as {
    host: string;
    port: number;
    password?: string;
    tls: boolean;
  };

  return {
    host: redis.host,
    port: redis.port,
    password: redis.password,
    ...(redis.tls ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const logger = new Logger('RedisModule');
        const client = new Redis(buildRedisOptions(config));
        client.on('connect', () => logger.log('Redis connected'));
        client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
