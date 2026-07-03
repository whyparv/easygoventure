import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { FulfillmentItem, FulfillmentItemDocument } from './schemas/fulfillment-item.schema';

@Injectable()
export class FulfillmentItemsRepository extends TenantScopedRepository<FulfillmentItemDocument> {
  constructor(@InjectModel(FulfillmentItem.name) model: Model<FulfillmentItemDocument>) {
    super(model);
  }

  create(data: Partial<FulfillmentItem>): Promise<FulfillmentItemDocument> {
    return this.model.create(data);
  }

  /** All non-deleted fulfillment items for a proposal, tenant-scoped. */
  findByProposal(
    scope: FilterQuery<FulfillmentItemDocument>,
    proposalId: Types.ObjectId,
  ): Promise<FulfillmentItemDocument[]> {
    return this.model
      .find({ ...scope, proposalId, isDeleted: { $ne: true } })
      .sort({ createdAt: 1 })
      .exec();
  }

  countByProposal(
    scope: FilterQuery<FulfillmentItemDocument>,
    proposalId: Types.ObjectId,
  ): Promise<number> {
    return this.model
      .countDocuments({ ...scope, proposalId, isDeleted: { $ne: true } })
      .exec();
  }
}
