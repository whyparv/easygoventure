import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Permission, PermissionDocument } from './schemas/permission.schema';

@Injectable()
export class PermissionsRepository {
  constructor(
    @InjectModel(Permission.name) private readonly model: Model<PermissionDocument>,
  ) {}

  findAll(): Promise<PermissionDocument[]> {
    return this.model.find().sort({ group: 1, key: 1 }).exec();
  }

  /** Idempotent upsert used by the catalog seeder. */
  async upsert(data: Partial<Permission>): Promise<void> {
    await this.model.updateOne({ key: data.key }, { $set: data }, { upsert: true }).exec();
  }
}
