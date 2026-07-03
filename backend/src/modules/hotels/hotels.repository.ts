import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder } from 'mongoose';
import { HotelCatalog, HotelCatalogDocument } from './schemas/hotel-catalog.schema';

export interface PaginateOptions {
  skip: number;
  limit: number;
  sort: Record<string, SortOrder>;
}

@Injectable()
export class HotelsRepository {
  constructor(
    @InjectModel(HotelCatalog.name) private readonly model: Model<HotelCatalogDocument>,
  ) {}

  findById(id: string): Promise<HotelCatalogDocument | null> {
    return this.model.findOne({ _id: id, isDeleted: { $ne: true } }).exec();
  }

  async paginate(
    filter: FilterQuery<HotelCatalogDocument>,
    options: PaginateOptions,
  ): Promise<{ items: HotelCatalogDocument[]; total: number }> {
    const scoped: FilterQuery<HotelCatalogDocument> = { ...filter, isDeleted: { $ne: true } };
    const [items, total] = await Promise.all([
      this.model.find(scoped).sort(options.sort).skip(options.skip).limit(options.limit).exec(),
      this.model.countDocuments(scoped).exec(),
    ]);
    return { items, total };
  }
}
