import { Injectable } from '@nestjs/common';
import { NotFoundException } from '../../common/exceptions/app.exceptions';
import { ServiceCategoriesRepository } from './service-categories.repository';
import { ServiceCategoryDocument } from './schemas/service-category.schema';

@Injectable()
export class ServiceCategoriesService {
  constructor(private readonly categories: ServiceCategoriesRepository) {}

  findAll(): Promise<ServiceCategoryDocument[]> {
    return this.categories.findAll();
  }

  async findByCodeOrThrow(code: string): Promise<ServiceCategoryDocument> {
    const category = await this.categories.findByCode(code);
    if (!category) {
      throw new NotFoundException(
        `Service category "${code}" not found`,
        'SERVICE_CATEGORY_NOT_FOUND',
      );
    }
    return category;
  }
}
