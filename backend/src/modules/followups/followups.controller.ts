import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { FollowUpsService } from './followups.service';
import { CreateFollowUpDto } from './dto/create-followup.dto';
import { UpdateFollowUpDto } from './dto/update-followup.dto';
import { QueryFollowUpDto } from './dto/query-followup.dto';
import { FollowUpResponseDto } from './dto/followup-response.dto';

@ApiTags('followups')
@ApiStandardErrors()
@Controller('followups')
export class FollowUpsController {
  constructor(private readonly followupsService: FollowUpsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.FOLLOWUP_CREATE)
  @ApiOperation({ summary: 'Schedule a follow-up for a lead' })
  @ApiStandardResponse(FollowUpResponseDto, { status: 201 })
  async create(@Body() dto: CreateFollowUpDto, @CurrentUser() user: AuthenticatedUser) {
    const followup = await this.followupsService.create(dto, user);
    return new ApiResponse(followup, 'Follow-up scheduled');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.FOLLOWUP_READ)
  @ApiOperation({ summary: 'List follow-ups (paginated, filterable)' })
  @ApiStandardResponse(FollowUpResponseDto, { paginated: true })
  findAll(@Query() query: QueryFollowUpDto, @CurrentUser() user: AuthenticatedUser) {
    return this.followupsService.findAll(query, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.FOLLOWUP_UPDATE)
  @ApiOperation({ summary: 'Update a follow-up / record its outcome' })
  @ApiStandardResponse(FollowUpResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFollowUpDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const followup = await this.followupsService.update(id, dto, user);
    return new ApiResponse(followup, 'Follow-up updated');
  }
}
