import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface PaginateOptions {
  skip: number;
  limit: number;
  sort: Record<string, SortOrder>;
}

@Injectable()
export class AuditRepository {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLogDocument>) {}

  create(data: Partial<AuditLog>): Promise<AuditLogDocument> {
    return this.model.create(data);
  }

  async paginate(
    filter: FilterQuery<AuditLogDocument>,
    options: PaginateOptions,
  ): Promise<{ items: AuditLogDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.model.find(filter).sort(options.sort).skip(options.skip).limit(options.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
