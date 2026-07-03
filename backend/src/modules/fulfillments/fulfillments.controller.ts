import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { FulfillmentsService } from './fulfillments.service';
import { CreateFulfillmentDto } from './dto/create-fulfillment.dto';
import { UpdateFulfillmentDto } from './dto/update-fulfillment.dto';
import { QueryFulfillmentDto } from './dto/query-fulfillment.dto';
import { FulfillmentResponseDto } from './dto/fulfillment-response.dto';

@ApiTags('fulfillments')
@ApiStandardErrors()
@Controller('fulfillments')
export class FulfillmentsController {
  constructor(private readonly fulfillmentsService: FulfillmentsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.FULFILLMENT_CREATE)
  @ApiOperation({ summary: 'Create a fulfillment (visa case, booking, transfer, etc.)' })
  @ApiStandardResponse(FulfillmentResponseDto, { status: 201 })
  async create(@Body() dto: CreateFulfillmentDto, @CurrentUser() user: AuthenticatedUser) {
    const fulfillment = await this.fulfillmentsService.create(dto, user);
    return new ApiResponse(fulfillment, 'Fulfillment created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.FULFILLMENT_READ)
  @ApiOperation({ summary: 'List fulfillments (paginated, filterable)' })
  @ApiStandardResponse(FulfillmentResponseDto, { paginated: true })
  findAll(@Query() query: QueryFulfillmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.fulfillmentsService.findAll(query, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.FULFILLMENT_UPDATE)
  @ApiOperation({ summary: 'Update a fulfillment status / remarks / due date' })
  @ApiStandardResponse(FulfillmentResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFulfillmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const fulfillment = await this.fulfillmentsService.update(id, dto, user);
    return new ApiResponse(fulfillment, 'Fulfillment updated');
  }
}
