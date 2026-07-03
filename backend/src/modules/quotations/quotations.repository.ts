import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Quotation, QuotationDocument } from './schemas/quotation.schema';

@Injectable()
export class QuotationsRepository extends TenantScopedRepository<QuotationDocument> {
  constructor(@InjectModel(Quotation.name) model: Model<QuotationDocument>) {
    super(model);
  }

  create(data: Partial<Quotation>): Promise<QuotationDocument> {
    return this.model.create(data);
  }

  /** How many quotations already exist for a package (drives the version number). */
  countByPackage(
    scope: FilterQuery<QuotationDocument>,
    packageId: Types.ObjectId,
  ): Promise<number> {
    return this.model.countDocuments({ ...scope, packageId, isDeleted: { $ne: true } }).exec();
  }
}
