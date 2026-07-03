import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Convenience facade over the shared Redis client.
 * Feature modules inject this rather than touching ioredis directly.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}

  async ping(): Promise<boolean> {
    const res = await this.client.ping();
    return res === 'PONG';
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
