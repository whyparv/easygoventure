import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Package, PackageDocument } from './schemas/package.schema';

@Injectable()
export class PackagesRepository extends TenantScopedRepository<PackageDocument> {
  constructor(@InjectModel(Package.name) model: Model<PackageDocument>) {
    super(model);
  }

  create(data: Partial<Package>): Promise<PackageDocument> {
    return this.model.create(data);
  }
}
