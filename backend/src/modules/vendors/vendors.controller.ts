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
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { QueryVendorDto } from './dto/query-vendor.dto';
import { DeletedResponseDto, VendorResponseDto } from './dto/vendor-response.dto';

@ApiTags('vendors')
@ApiStandardErrors()
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.VENDOR_CREATE)
  @ApiOperation({ summary: 'Create a vendor' })
  @ApiStandardResponse(VendorResponseDto, { status: 201 })
  async create(@Body() dto: CreateVendorDto, @CurrentUser() user: AuthenticatedUser) {
    const vendor = await this.vendorsService.create(dto, user);
    return new ApiResponse(vendor, 'Vendor created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.VENDOR_READ)
  @ApiOperation({ summary: 'List vendors (paginated, filterable)' })
  @ApiStandardResponse(VendorResponseDto, { paginated: true })
  findAll(@Query() query: QueryVendorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_READ)
  @ApiOperation({ summary: 'Get a vendor by id' })
  @ApiStandardResponse(VendorResponseDto)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.findByIdOrThrow(id, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_UPDATE)
  @ApiOperation({ summary: 'Update a vendor' })
  @ApiStandardResponse(VendorResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const vendor = await this.vendorsService.update(id, dto, user);
    return new ApiResponse(vendor, 'Vendor updated');
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_DELETE)
  @ApiOperation({ summary: 'Soft delete a vendor (relations preserved)' })
  @ApiStandardResponse(DeletedResponseDto)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.vendorsService.remove(id, user);
    return new ApiResponse({ id }, 'Vendor deleted');
  }
}
