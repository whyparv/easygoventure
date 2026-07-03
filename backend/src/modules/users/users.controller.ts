import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { DeletedResponseDto, UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@ApiStandardErrors()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({ summary: 'Create a user in your organization' })
  @ApiStandardResponse(UserResponseDto, { status: 201 })
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return new ApiResponse(await this.usersService.create(dto, actor), 'User created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'List users (scoped to your organization)' })
  @ApiStandardResponse(UserResponseDto, { paginated: true })
  findAll(@Query() query: QueryUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.findAll(query, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiStandardResponse(UserResponseDto)
  async findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return new ApiResponse(await this.usersService.findByIdOrThrow(id, actor));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  @ApiOperation({ summary: 'Update a user profile/status' })
  @ApiStandardResponse(UserResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.usersService.update(id, dto, actor), 'User updated');
  }

  @Post(':id/roles')
  @RequirePermissions(PERMISSIONS.ROLE_ASSIGN)
  @ApiOperation({ summary: "Set a user's roles" })
  @ApiStandardResponse(UserResponseDto)
  async assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.usersService.assignRoles(id, dto, actor), 'Roles assigned');
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USER_DELETE)
  @ApiOperation({ summary: 'Deactivate (soft-delete) a user' })
  @ApiStandardResponse(DeletedResponseDto)
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.usersService.remove(id, actor);
    return new ApiResponse({ id }, 'User deleted');
  }
}
