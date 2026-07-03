import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Vendor, VendorDocument } from './schemas/vendor.schema';

@Injectable()
export class VendorsRepository extends TenantScopedRepository<VendorDocument> {
  constructor(@InjectModel(Vendor.name) model: Model<VendorDocument>) {
    super(model);
  }

  create(data: Partial<Vendor>): Promise<VendorDocument> {
    return this.model.create(data);
  }
}
