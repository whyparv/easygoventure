import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import { ServiceCategoriesService } from './service-categories.service';
import { ServiceCategoryResponseDto } from './dto/service-response.dto';

@ApiTags('service-categories')
@ApiStandardErrors()
@Controller('service-categories')
export class ServiceCategoriesController {
  constructor(private readonly serviceCategoriesService: ServiceCategoriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SERVICE_READ)
  @ApiOperation({ summary: 'List all service categories (global reference data)' })
  @ApiStandardResponse(ServiceCategoryResponseDto, { array: true })
  async findAll() {
    const categories = await this.serviceCategoriesService.findAll();
    return new ApiResponse(categories);
  }
}
