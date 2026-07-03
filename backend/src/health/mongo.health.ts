import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';

@Injectable()
export class MongoHealthIndicator extends HealthIndicator {
  constructor(@InjectConnection() private readonly connection: Connection) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      if (Number(this.connection.readyState) !== 1 || !this.connection.db) {
        throw new Error(`connection not ready (state ${this.connection.readyState})`);
      }
      await this.connection.db.admin().ping();
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'MongoDB health check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'unknown error',
        }),
      );
    }
  }
}
