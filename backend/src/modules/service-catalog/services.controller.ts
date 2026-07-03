import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryServiceDto } from './dto/query-service.dto';
import { DeletedResponseDto, ServiceResponseDto } from './dto/service-response.dto';

@ApiTags('services')
@ApiStandardErrors()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SERVICE_CREATE)
  @ApiOperation({ summary: 'Create a service for the current organization' })
  @ApiStandardResponse(ServiceResponseDto, { status: 201 })
  async create(@Body() dto: CreateServiceDto, @CurrentUser() user: AuthenticatedUser) {
    const service = await this.servicesService.create(dto, user);
    return new ApiResponse(service, 'Service created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SERVICE_READ)
  @ApiOperation({ summary: 'List services (paginated, filterable, tenant-scoped)' })
  @ApiStandardResponse(ServiceResponseDto, { paginated: true })
  findAll(@Query() query: QueryServiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.servicesService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SERVICE_READ)
  @ApiOperation({ summary: 'Get a service by id' })
  @ApiStandardResponse(ServiceResponseDto)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.servicesService.findByIdOrThrow(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SERVICE_UPDATE)
  @ApiOperation({ summary: 'Update a service' })
  @ApiStandardResponse(ServiceResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const service = await this.servicesService.update(id, dto, user);
    return new ApiResponse(service, 'Service updated');
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SERVICE_DELETE)
  @ApiOperation({ summary: 'Soft delete a service (relations preserved)' })
  @ApiStandardResponse(DeletedResponseDto)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.servicesService.remove(id, user);
    return new ApiResponse({ id }, 'Service deleted');
  }
}
