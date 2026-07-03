import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ServiceCategory,
  ServiceCategoryDocument,
} from './schemas/service-category.schema';

@Injectable()
export class ServiceCategoriesRepository {
  constructor(
    @InjectModel(ServiceCategory.name)
    private readonly model: Model<ServiceCategoryDocument>,
  ) {}

  findAll(): Promise<ServiceCategoryDocument[]> {
    return this.model.find().sort({ sortOrder: 1, name: 1 }).exec();
  }

  findByCode(code: string): Promise<ServiceCategoryDocument | null> {
    return this.model.findOne({ code }).exec();
  }

  /** Idempotent write used by the seeder — creates or updates by unique `code`. */
  async upsert(data: Partial<ServiceCategory>): Promise<void> {
    await this.model.updateOne({ code: data.code }, { $set: data }, { upsert: true }).exec();
  }
}
