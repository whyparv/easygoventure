import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { QueryOrganizationDto } from './dto/query-organization.dto';
import {
  DeletedResponseDto,
  OrganizationResponseDto,
} from './dto/organization-response.dto';

@ApiTags('organizations')
@ApiStandardErrors()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  @ApiOperation({ summary: 'Provision a new organization (platform super-admin only)' })
  @ApiStandardResponse(OrganizationResponseDto, { status: 201 })
  async create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.organizationsService.create(dto, user), 'Organization created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ORGANIZATION_READ)
  @ApiOperation({ summary: 'List organizations (scoped to you unless super-admin)' })
  @ApiStandardResponse(OrganizationResponseDto, { paginated: true })
  findAll(@Query() query: QueryOrganizationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_READ)
  @ApiOperation({ summary: 'Get an organization by id' })
  @ApiStandardResponse(OrganizationResponseDto)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.organizationsService.findByIdOrThrow(id, user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  @ApiOperation({ summary: 'Update an organization' })
  @ApiStandardResponse(OrganizationResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(
      await this.organizationsService.update(id, dto, user),
      'Organization updated',
    );
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_MANAGE)
  @ApiOperation({ summary: 'Delete an organization (platform super-admin only)' })
  @ApiStandardResponse(DeletedResponseDto)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.organizationsService.remove(id, user);
    return new ApiResponse({ id }, 'Organization deleted');
  }
}
