import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Fulfillment, FulfillmentDocument } from './schemas/fulfillment.schema';

export interface PaginateOptions {
  skip: number;
  limit: number;
  sort: Record<string, SortOrder>;
}

@Injectable()
export class FulfillmentsRepository {
  constructor(
    @InjectModel(Fulfillment.name) private readonly model: Model<FulfillmentDocument>,
  ) {}

  create(data: Partial<Fulfillment>, session?: ClientSession): Promise<FulfillmentDocument> {
    return new this.model(data).save({ session });
  }

  findById(id: string, tenant: FilterQuery<FulfillmentDocument> = {}): Promise<FulfillmentDocument | null> {
    return this.model.findOne({ _id: id, ...tenant, isDeleted: { $ne: true } }).exec();
  }

  async paginate(
    filter: FilterQuery<FulfillmentDocument>,
    options: PaginateOptions,
  ): Promise<{ items: FulfillmentDocument[]; total: number }> {
    const scoped: FilterQuery<FulfillmentDocument> = { ...filter, isDeleted: { $ne: true } };
    const [items, total] = await Promise.all([
      this.model.find(scoped).sort(options.sort).skip(options.skip).limit(options.limit).exec(),
      this.model.countDocuments(scoped).exec(),
    ]);
    return { items, total };
  }

  update(
    id: string,
    data: Partial<Fulfillment>,
    tenant: FilterQuery<FulfillmentDocument> = {},
  ): Promise<FulfillmentDocument | null> {
    return this.model.findOneAndUpdate({ _id: id, ...tenant }, data, { new: true }).exec();
  }

  /** Count fulfillments for a lead that are NOT in a terminal state (completed/cancelled). */
  countUnresolvedByLead(
    leadId: Types.ObjectId,
    terminalStatuses: string[],
    tenant: FilterQuery<FulfillmentDocument> = {},
  ): Promise<number> {
    return this.model
      .countDocuments({
        leadId,
        ...tenant,
        isDeleted: { $ne: true },
        status: { $nin: terminalStatuses },
      })
      .exec();
  }
}
