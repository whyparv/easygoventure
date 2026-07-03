import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder } from 'mongoose';
import { FollowUp, FollowUpDocument } from './schemas/followup.schema';

export interface PaginateOptions {
  skip: number;
  limit: number;
  sort: Record<string, SortOrder>;
}

@Injectable()
export class FollowUpsRepository {
  constructor(@InjectModel(FollowUp.name) private readonly model: Model<FollowUpDocument>) {}

  create(data: Partial<FollowUp>): Promise<FollowUpDocument> {
    return this.model.create(data);
  }

  findById(id: string, tenant: FilterQuery<FollowUpDocument> = {}): Promise<FollowUpDocument | null> {
    return this.model.findOne({ _id: id, ...tenant, isDeleted: { $ne: true } }).exec();
  }

  async paginate(
    filter: FilterQuery<FollowUpDocument>,
    options: PaginateOptions,
  ): Promise<{ items: FollowUpDocument[]; total: number }> {
    const scoped: FilterQuery<FollowUpDocument> = { ...filter, isDeleted: { $ne: true } };
    const [items, total] = await Promise.all([
      this.model.find(scoped).sort(options.sort).skip(options.skip).limit(options.limit).exec(),
      this.model.countDocuments(scoped).exec(),
    ]);
    return { items, total };
  }

  update(
    id: string,
    data: Partial<FollowUp>,
    tenant: FilterQuery<FollowUpDocument> = {},
  ): Promise<FollowUpDocument | null> {
    return this.model.findOneAndUpdate({ _id: id, ...tenant }, data, { new: true }).exec();
  }
}
