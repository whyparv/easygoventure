import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Traveler, TravelerDocument } from './schemas/traveler.schema';

@Injectable()
export class TravelersRepository extends TenantScopedRepository<TravelerDocument> {
  constructor(@InjectModel(Traveler.name) model: Model<TravelerDocument>) {
    super(model);
  }

  create(data: Partial<Traveler>): Promise<TravelerDocument> {
    return this.model.create(data);
  }

  /** All non-deleted travelers for a proposal, tenant-scoped. */
  findByProposal(
    scope: FilterQuery<TravelerDocument>,
    proposalId: Types.ObjectId,
  ): Promise<TravelerDocument[]> {
    return this.model
      .find({ ...scope, proposalId, isDeleted: { $ne: true } })
      .sort({ createdAt: 1 })
      .exec();
  }

  countByProposal(
    scope: FilterQuery<TravelerDocument>,
    proposalId: Types.ObjectId,
  ): Promise<number> {
    return this.model
      .countDocuments({ ...scope, proposalId, isDeleted: { $ne: true } })
      .exec();
  }
}
