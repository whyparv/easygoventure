import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { MongoHealthIndicator } from './mongo.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [MongoHealthIndicator],
})
export class HealthModule {}
