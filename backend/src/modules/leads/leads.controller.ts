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
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { CreateLeadActivityDto } from './dto/create-lead-activity.dto';
import {
  DeletedResponseDto,
  LeadActivityResponseDto,
  LeadResponseDto,
} from './dto/lead-response.dto';

@ApiTags('leads')
@ApiStandardErrors()
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.LEAD_CREATE)
  @ApiOperation({ summary: 'Create a lead from an inquiry' })
  @ApiStandardResponse(LeadResponseDto, { status: 201 })
  async create(@Body() dto: CreateLeadDto, @CurrentUser() user: AuthenticatedUser) {
    const lead = await this.leadsService.create(dto, user);
    return new ApiResponse(lead, 'Lead created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LEAD_READ)
  @ApiOperation({ summary: 'List leads (paginated, filterable)' })
  @ApiStandardResponse(LeadResponseDto, { paginated: true })
  findAll(@Query() query: QueryLeadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.LEAD_READ)
  @ApiOperation({ summary: 'Get a lead by id' })
  @ApiStandardResponse(LeadResponseDto)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.findByIdOrThrow(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.LEAD_UPDATE)
  @ApiOperation({ summary: 'Update a lead' })
  @ApiStandardResponse(LeadResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const lead = await this.leadsService.update(id, dto, user);
    return new ApiResponse(lead, 'Lead updated');
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.LEAD_DELETE)
  @ApiOperation({ summary: 'Soft delete a lead (relations preserved)' })
  @ApiStandardResponse(DeletedResponseDto)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.leadsService.remove(id, user);
    return new ApiResponse({ id }, 'Lead deleted');
  }

  @Post(':id/activities')
  @RequirePermissions(PERMISSIONS.LEAD_UPDATE)
  @ApiOperation({ summary: 'Add a timeline activity to a lead' })
  @ApiStandardResponse(LeadActivityResponseDto, { status: 201 })
  async addActivity(
    @Param('id') id: string,
    @Body() dto: CreateLeadActivityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const activity = await this.leadsService.addActivity(id, dto, user);
    return new ApiResponse(activity, 'Activity recorded');
  }

  @Get(':id/activities')
  @RequirePermissions(PERMISSIONS.LEAD_READ)
  @ApiOperation({ summary: 'Get the timeline (activities) for a lead' })
  @ApiStandardResponse(LeadActivityResponseDto, { array: true })
  listActivities(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.listActivities(id, user);
  }
}
