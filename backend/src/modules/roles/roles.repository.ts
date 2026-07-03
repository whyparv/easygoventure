import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Role, RoleDocument } from './schemas/role.schema';

@Injectable()
export class RolesRepository extends TenantScopedRepository<RoleDocument> {
  constructor(@InjectModel(Role.name) model: Model<RoleDocument>) {
    super(model);
  }

  create(data: Partial<Role>): Promise<RoleDocument> {
    return this.model.create(data);
  }

  /**
   * Read by id WITHOUT an org filter, because role visibility is a union — a role
   * is visible if it is a shared system template (organizationId: null) OR belongs
   * to the caller's org. The service applies that union predicate (`isVisibleTo`).
   */
  findById(id: string): Promise<RoleDocument | null> {
    return this.model.findOne({ _id: id, isDeleted: { $ne: true } }).exec();
  }

  find(filter: FilterQuery<RoleDocument>): Promise<RoleDocument[]> {
    return this.model
      .find({ ...filter, isDeleted: { $ne: true } })
      .sort({ isSystem: -1, name: 1 })
      .exec();
  }

  findByIds(ids: Types.ObjectId[]): Promise<RoleDocument[]> {
    return this.model.find({ _id: { $in: ids }, isDeleted: { $ne: true } }).exec();
  }

  /** Idempotent upsert for seeding system-role templates (organizationId = null). */
  async upsertSystemRole(code: string, data: Partial<Role>): Promise<void> {
    await this.model
      .updateOne({ organizationId: null, code }, { $set: data }, { upsert: true })
      .exec();
  }
}
