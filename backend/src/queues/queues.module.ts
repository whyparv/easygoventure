import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { buildRedisOptions } from '../redis/redis.module';
import { QUEUE_NAMES } from './queue.constants';

/**
 * Wires BullMQ to the shared Redis connection and registers the application queues.
 * Processors are intentionally not registered yet — this is infrastructure only.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: buildRedisOptions(config),
        prefix: '{dmc-crm}',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 24 * 3600 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.REPORTS },
      { name: QUEUE_NAMES.FOLLOWUPS },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
