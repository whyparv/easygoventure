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
import { VendorRatesService } from './vendor-rates.service';
import { CreateVendorRateDto } from './dto/create-vendor-rate.dto';
import { UpdateVendorRateDto } from './dto/update-vendor-rate.dto';
import { QueryVendorRateDto } from './dto/query-vendor-rate.dto';
import { VendorRateResponseDto } from './dto/vendor-rate-response.dto';
import { DeletedResponseDto } from './dto/vendor-response.dto';

@ApiTags('vendor-rates')
@ApiStandardErrors()
@Controller('vendor-rates')
export class VendorRatesController {
  constructor(private readonly ratesService: VendorRatesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.VENDOR_RATE_CREATE)
  @ApiOperation({ summary: 'Create a vendor rate' })
  @ApiStandardResponse(VendorRateResponseDto, { status: 201 })
  async create(@Body() dto: CreateVendorRateDto, @CurrentUser() user: AuthenticatedUser) {
    const rate = await this.ratesService.create(dto, user);
    return new ApiResponse(rate, 'Vendor rate created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.VENDOR_RATE_READ)
  @ApiOperation({ summary: 'List vendor rates (paginated, filterable)' })
  @ApiStandardResponse(VendorRateResponseDto, { paginated: true })
  findAll(@Query() query: QueryVendorRateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ratesService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_RATE_READ)
  @ApiOperation({ summary: 'Get a vendor rate by id' })
  @ApiStandardResponse(VendorRateResponseDto)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ratesService.findByIdOrThrow(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_RATE_UPDATE)
  @ApiOperation({ summary: 'Update a vendor rate' })
  @ApiStandardResponse(VendorRateResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const rate = await this.ratesService.update(id, dto, user);
    return new ApiResponse(rate, 'Vendor rate updated');
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_RATE_DELETE)
  @ApiOperation({ summary: 'Soft delete a vendor rate' })
  @ApiStandardResponse(DeletedResponseDto)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.ratesService.remove(id, user);
    return new ApiResponse({ id }, 'Vendor rate deleted');
  }
}
