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
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AgenciesService } from './agencies.service';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { QueryAgencyDto } from './dto/query-agency.dto';

class FindOrCreateAgencyDto {
  @ApiProperty({ example: 'Sunrise Travel' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ required: false, example: '+971501234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'info@sunrisetravel.ae' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

@ApiTags('agencies')
@ApiStandardErrors()
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.AGENCY_CREATE)
  @ApiOperation({ summary: 'Create an agency' })
  @ApiStandardResponse(Object, { status: 201 })
  async create(@Body() dto: CreateAgencyDto, @CurrentUser() user: AuthenticatedUser) {
    const agency = await this.agenciesService.create(dto, user);
    return new ApiResponse(agency, 'Agency created');
  }

  @Post('find-or-create')
  @RequirePermissions(PERMISSIONS.AGENCY_CREATE)
  @ApiOperation({ summary: 'Find an agency by name or create it if it does not exist' })
  @ApiStandardResponse(Object, { status: 201 })
  async findOrCreate(
    @Body() dto: FindOrCreateAgencyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const agency = await this.agenciesService.findOrCreate(dto.name, dto.phone, dto.email, user);
    return new ApiResponse(agency, 'Agency found or created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.AGENCY_READ)
  @ApiOperation({ summary: 'List agencies (paginated, filterable)' })
  @ApiStandardResponse(Object, { paginated: true })
  findAll(@Query() query: QueryAgencyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.agenciesService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.AGENCY_READ)
  @ApiOperation({ summary: 'Get an agency by id' })
  @ApiStandardResponse(Object)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agenciesService.findByIdOrThrow(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.AGENCY_UPDATE)
  @ApiOperation({ summary: 'Update an agency' })
  @ApiStandardResponse(Object)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAgencyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const agency = await this.agenciesService.update(id, dto, user);
    return new ApiResponse(agency, 'Agency updated');
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.AGENCY_DELETE)
  @ApiOperation({ summary: 'Soft delete an agency (relations preserved)' })
  @ApiStandardResponse(Object)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.agenciesService.remove(id, user);
    return new ApiResponse({ id }, 'Agency deleted');
  }
}
