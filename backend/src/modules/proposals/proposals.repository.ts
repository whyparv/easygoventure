import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Proposal, ProposalDocument, ProposalStatus } from './schemas/proposal.schema';

export interface PaginateOptions {
  skip: number;
  limit: number;
  sort: Record<string, SortOrder>;
}

@Injectable()
export class ProposalsRepository {
  constructor(@InjectModel(Proposal.name) private readonly model: Model<ProposalDocument>) {}

  create(data: Partial<Proposal>): Promise<ProposalDocument> {
    return this.model.create(data);
  }

  findById(id: string, tenant: FilterQuery<ProposalDocument> = {}): Promise<ProposalDocument | null> {
    return this.model.findOne({ _id: id, ...tenant, isDeleted: { $ne: true } }).exec();
  }

  async paginate(
    filter: FilterQuery<ProposalDocument>,
    options: PaginateOptions,
  ): Promise<{ items: ProposalDocument[]; total: number }> {
    const scoped: FilterQuery<ProposalDocument> = { ...filter, isDeleted: { $ne: true } };
    const [items, total] = await Promise.all([
      this.model.find(scoped).sort(options.sort).skip(options.skip).limit(options.limit).exec(),
      this.model.countDocuments(scoped).exec(),
    ]);
    return { items, total };
  }

  update(
    id: string,
    data: Partial<Proposal>,
    tenant: FilterQuery<ProposalDocument> = {},
  ): Promise<ProposalDocument | null> {
    return this.model.findOneAndUpdate({ _id: id, ...tenant }, data, { new: true }).exec();
  }

  /**
   * Atomically move a proposal from one of `from` to `to`. Returns the updated
   * document, or null if no document matched (already transitioned / wrong state).
   * This is the concurrency guard that prevents a double-accept. The optional
   * `tenant` fragment keeps the transition scoped to the caller's organization.
   */
  transitionStatus(
    id: string,
    from: ProposalStatus[],
    to: ProposalStatus,
    session?: ClientSession,
    tenant: FilterQuery<ProposalDocument> = {},
  ): Promise<ProposalDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id, status: { $in: from }, ...tenant, isDeleted: { $ne: true } },
        { status: to },
        { new: true, session },
      )
      .exec();
  }

  /** Count proposals within a tenant scope (excludes soft-deleted). */
  countScoped(
    tenant: FilterQuery<ProposalDocument>,
    filter: FilterQuery<ProposalDocument> = {},
  ): Promise<number> {
    return this.model
      .countDocuments({ ...tenant, ...filter, isDeleted: { $ne: true } })
      .exec();
  }

  /** Ids of proposals matching a tenant-scoped filter (for scoped fan-out counts). */
  async findIdsScoped(
    tenant: FilterQuery<ProposalDocument>,
    filter: FilterQuery<ProposalDocument> = {},
  ): Promise<Types.ObjectId[]> {
    const rows = await this.model
      .find({ ...tenant, ...filter, isDeleted: { $ne: true } })
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>()
      .exec();
    return rows.map((r) => r._id);
  }

  toObjectId(id: string): Types.ObjectId {
    return new Types.ObjectId(id);
  }
}
