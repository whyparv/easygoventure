import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { DeletedResponseDto, RoleResponseDto } from './dto/role-response.dto';

@ApiTags('roles')
@ApiStandardErrors()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'List roles (system templates + your organization roles)' })
  @ApiStandardResponse(RoleResponseDto, { array: true })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.rolesService.findAllForActor(user));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'Get a role by id' })
  @ApiStandardResponse(RoleResponseDto)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.rolesService.findByIdOrThrow(id, user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLE_CREATE)
  @ApiOperation({ summary: 'Create a custom role' })
  @ApiStandardResponse(RoleResponseDto, { status: 201 })
  async create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.rolesService.create(dto, user), 'Role created');
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ROLE_UPDATE)
  @ApiOperation({ summary: 'Update a custom role' })
  @ApiStandardResponse(RoleResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.rolesService.update(id, dto, user), 'Role updated');
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ROLE_DELETE)
  @ApiOperation({ summary: 'Delete a custom role' })
  @ApiStandardResponse(DeletedResponseDto)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.rolesService.remove(id, user);
    return new ApiResponse({ id }, 'Role deleted');
  }
}
