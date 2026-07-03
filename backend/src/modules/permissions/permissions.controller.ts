import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import { PermissionsService } from './permissions.service';

@ApiTags('permissions')
@ApiStandardErrors()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PERMISSION_READ)
  @ApiOperation({ summary: 'List the permission catalog' })
  @ApiQuery({ name: 'grouped', required: false, type: Boolean })
  async findAll(@Query('grouped') grouped?: string) {
    if (grouped === 'true') {
      return new ApiResponse(await this.permissionsService.findGrouped());
    }
    return new ApiResponse(await this.permissionsService.findAll());
  }
}
