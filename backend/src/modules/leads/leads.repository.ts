import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, SortOrder } from 'mongoose';
import { Lead, LeadDocument } from './schemas/lead.schema';

export interface PaginateOptions {
  skip: number;
  limit: number;
  sort: Record<string, SortOrder>;
}

@Injectable()
export class LeadsRepository {
  constructor(@InjectModel(Lead.name) private readonly model: Model<LeadDocument>) {}

  create(data: Partial<Lead>): Promise<LeadDocument> {
    return this.model.create(data);
  }

  /** Tenant-scoped read: `tenant` carries the organization filter (empty for super-admin). */
  findById(id: string, tenant: FilterQuery<LeadDocument> = {}): Promise<LeadDocument | null> {
    return this.model.findOne({ _id: id, ...tenant, isDeleted: { $ne: true } }).exec();
  }

  async paginate(
    filter: FilterQuery<LeadDocument>,
    options: PaginateOptions,
  ): Promise<{ items: LeadDocument[]; total: number }> {
    // Callers include the tenant fragment in `filter`; soft-deleted are excluded here.
    const scoped: FilterQuery<LeadDocument> = { ...filter, isDeleted: { $ne: true } };
    const [items, total] = await Promise.all([
      this.model.find(scoped).sort(options.sort).skip(options.skip).limit(options.limit).exec(),
      this.model.countDocuments(scoped).exec(),
    ]);
    return { items, total };
  }

  update(
    id: string,
    data: Partial<Lead>,
    tenant: FilterQuery<LeadDocument> = {},
    session?: ClientSession,
  ): Promise<LeadDocument | null> {
    return this.model
      .findOneAndUpdate({ _id: id, ...tenant }, data, { new: true, session })
      .exec();
  }

  /** Soft delete — flags the document; relations are never orphaned. */
  softDelete(id: string, tenant: FilterQuery<LeadDocument> = {}): Promise<LeadDocument | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id, ...tenant },
        { isDeleted: true, deletedAt: new Date() },
        { new: true },
      )
      .exec();
  }
}
