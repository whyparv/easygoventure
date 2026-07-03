import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { PackageItem, PackageItemDocument } from './schemas/package-item.schema';

@Injectable()
export class PackageItemsRepository extends TenantScopedRepository<PackageItemDocument> {
  constructor(@InjectModel(PackageItem.name) model: Model<PackageItemDocument>) {
    super(model);
  }

  create(data: Partial<PackageItem>): Promise<PackageItemDocument> {
    return this.model.create(data);
  }

  /** All non-deleted items for a package, tenant-scoped. */
  findByPackage(
    scope: FilterQuery<PackageItemDocument>,
    packageId: Types.ObjectId,
  ): Promise<PackageItemDocument[]> {
    return this.model
      .find({ ...scope, packageId, isDeleted: { $ne: true } })
      .sort({ createdAt: 1 })
      .exec();
  }
}
