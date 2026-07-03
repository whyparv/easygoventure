import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TravelersService } from './travelers.service';
import { CreateTravelerDto, TravelerResponseDto, UpdateTravelerDto } from './dto/traveler.dto';

@ApiTags('operations-travelers')
@ApiStandardErrors()
@Controller()
export class TravelersController {
  constructor(private readonly travelers: TravelersService) {}

  @Post('proposals/:proposalId/travelers')
  @RequirePermissions(PERMISSIONS.TRAVELER_CREATE)
  @ApiOperation({ summary: 'Add a traveler to a proposal' })
  @ApiStandardResponse(TravelerResponseDto, { status: 201 })
  async create(
    @Param('proposalId') proposalId: string,
    @Body() dto: CreateTravelerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.travelers.create(proposalId, dto, user), 'Traveler added');
  }

  @Get('proposals/:proposalId/travelers')
  @RequirePermissions(PERMISSIONS.TRAVELER_READ)
  @ApiOperation({ summary: 'List a proposal’s travelers' })
  @ApiStandardResponse(TravelerResponseDto, { array: true })
  async list(@Param('proposalId') proposalId: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.travelers.list(proposalId, user));
  }

  @Get('travelers/:id')
  @RequirePermissions(PERMISSIONS.TRAVELER_READ)
  @ApiOperation({ summary: 'Get a traveler by id' })
  @ApiStandardResponse(TravelerResponseDto)
  async getOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.travelers.getOrThrow(id, user));
  }

  @Patch('travelers/:id')
  @RequirePermissions(PERMISSIONS.TRAVELER_UPDATE)
  @ApiOperation({ summary: 'Update a traveler' })
  @ApiStandardResponse(TravelerResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTravelerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.travelers.update(id, dto, user), 'Traveler updated');
  }

  @Delete('travelers/:id')
  @RequirePermissions(PERMISSIONS.TRAVELER_DELETE)
  @ApiOperation({ summary: 'Remove a traveler (soft delete)' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.travelers.remove(id, user);
    return new ApiResponse({ id, removed: true }, 'Traveler removed');
  }
}
