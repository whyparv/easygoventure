import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { VendorRate, VendorRateDocument, VendorRateStatus } from './schemas/vendor-rate.schema';

@Injectable()
export class VendorRatesRepository extends TenantScopedRepository<VendorRateDocument> {
  constructor(@InjectModel(VendorRate.name) model: Model<VendorRateDocument>) {
    super(model);
  }

  create(data: Partial<VendorRate>): Promise<VendorRateDocument> {
    return this.model.create(data);
  }

  /**
   * Active, non-deleted rates matching a (vendor, rateType, target) — the
   * candidate set the service checks for validity-window overlaps.
   */
  findActiveMatching(
    scope: FilterQuery<VendorRateDocument>,
    criteria: FilterQuery<VendorRateDocument>,
  ): Promise<VendorRateDocument[]> {
    return this.model
      .find({
        ...scope,
        ...criteria,
        status: VendorRateStatus.ACTIVE,
        isDeleted: { $ne: true },
      })
      .exec();
  }
}
