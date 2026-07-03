import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { QueryPackageDto } from './dto/query-package.dto';
import { CreatePackageItemDto } from './dto/create-package-item.dto';
import { UpdatePackageItemDto } from './dto/update-package-item.dto';
import {
  DeletedResponseDto,
  PackageItemResponseDto,
  PackageResponseDto,
} from './dto/package-response.dto';

@ApiTags('packages')
@ApiStandardErrors()
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.PACKAGE_CREATE)
  @ApiOperation({ summary: 'Create a package (internal costing workspace)' })
  @ApiStandardResponse(PackageResponseDto, { status: 201 })
  async create(@Body() dto: CreatePackageDto, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.packagesService.create(dto, user), 'Package created');
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PACKAGE_READ)
  @ApiOperation({ summary: 'List packages' })
  @ApiStandardResponse(PackageResponseDto, { paginated: true })
  findAll(@Query() query: QueryPackageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.packagesService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PACKAGE_READ)
  @ApiOperation({ summary: 'Get a package by id' })
  @ApiStandardResponse(PackageResponseDto)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.packagesService.findByIdOrThrow(id, user));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PACKAGE_UPDATE)
  @ApiOperation({ summary: 'Update a package' })
  @ApiStandardResponse(PackageResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.packagesService.update(id, dto, user), 'Package updated');
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PACKAGE_DELETE)
  @ApiOperation({ summary: 'Delete a package' })
  @ApiStandardResponse(DeletedResponseDto)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.packagesService.remove(id, user);
    return new ApiResponse({ id }, 'Package deleted');
  }

  @Post(':id/recalculate')
  @RequirePermissions(PERMISSIONS.PACKAGE_UPDATE)
  @ApiOperation({ summary: 'Recompute package totals from its items' })
  @ApiStandardResponse(PackageResponseDto)
  async recalculate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.packagesService.recalculate(id, user), 'Package recalculated');
  }

  // ── Items ────────────────────────────────────────────────────────────────

  @Get(':id/items')
  @RequirePermissions(PERMISSIONS.PACKAGE_READ)
  @ApiOperation({ summary: 'List a package’s items' })
  @ApiStandardResponse(PackageItemResponseDto, { array: true })
  async listItems(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.packagesService.listItems(id, user));
  }

  @Post(':id/items')
  @RequirePermissions(PERMISSIONS.PACKAGE_UPDATE)
  @ApiOperation({ summary: 'Add a priced item to a package' })
  @ApiStandardResponse(PackageItemResponseDto, { status: 201 })
  async addItem(
    @Param('id') id: string,
    @Body() dto: CreatePackageItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.packagesService.addItem(id, dto, user), 'Item added');
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions(PERMISSIONS.PACKAGE_UPDATE)
  @ApiOperation({ summary: 'Update a package item (recomputes totals)' })
  @ApiStandardResponse(PackageItemResponseDto)
  async updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePackageItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.packagesService.updateItem(id, itemId, dto, user), 'Item updated');
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions(PERMISSIONS.PACKAGE_UPDATE)
  @ApiOperation({ summary: 'Remove a package item (recomputes totals)' })
  @ApiStandardResponse(DeletedResponseDto)
  async removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.packagesService.removeItem(id, itemId, user);
    return new ApiResponse({ id: itemId }, 'Item removed');
  }
}
