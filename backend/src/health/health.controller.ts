import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../modules/auth/decorators/public.decorator';
import { SkipApiKey } from '../common/decorators/skip-api-key.decorator';
import { MongoHealthIndicator } from './mongo.health';

@ApiTags('health')
@SkipApiKey()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongo: MongoHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.mongo.isHealthy('database')]);
  }
}
