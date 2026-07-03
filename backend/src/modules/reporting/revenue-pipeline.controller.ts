import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RevenuePipelineService } from './revenue-pipeline.service';

@ApiTags('reporting')
@ApiStandardErrors()
@Controller('revenue-pipeline')
export class RevenuePipelineController {
  constructor(private readonly revenue: RevenuePipelineService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.REPORT_READ)
  @ApiOperation({ summary: 'Tenant-scoped commercial pipeline metrics' })
  async pipeline(@CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.revenue.getPipeline(user));
  }
}
