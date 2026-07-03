import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import {
  DeletedResponseDto,
  DepartmentResponseDto,
} from './dto/department-response.dto';

@ApiTags('departments')
@ApiStandardErrors()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_READ)
  @ApiOperation({ summary: 'List departments in your organization' })
  @ApiStandardResponse(DepartmentResponseDto, { array: true })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.departmentsService.findAll(user));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_READ)
  @ApiOperation({ summary: 'Get a department by id' })
  @ApiStandardResponse(DepartmentResponseDto)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.departmentsService.findByIdOrThrow(id, user));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_CREATE)
  @ApiOperation({ summary: 'Create a department' })
  @ApiStandardResponse(DepartmentResponseDto, { status: 201 })
  async create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.departmentsService.create(dto, user), 'Department created');
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_UPDATE)
  @ApiOperation({ summary: 'Update a department' })
  @ApiStandardResponse(DepartmentResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.departmentsService.update(id, dto, user), 'Department updated');
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_DELETE)
  @ApiOperation({ summary: 'Delete a department' })
  @ApiStandardResponse(DeletedResponseDto)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.departmentsService.remove(id, user);
    return new ApiResponse({ id }, 'Department deleted');
  }
}
