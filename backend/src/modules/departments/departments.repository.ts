import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Department, DepartmentDocument } from './schemas/department.schema';

@Injectable()
export class DepartmentsRepository extends TenantScopedRepository<DepartmentDocument> {
  constructor(@InjectModel(Department.name) model: Model<DepartmentDocument>) {
    super(model);
  }

  create(data: Partial<Department>): Promise<DepartmentDocument> {
    return this.model.create(data);
  }

  find(filter: FilterQuery<DepartmentDocument>): Promise<DepartmentDocument[]> {
    return this.model.find({ ...filter, isDeleted: { $ne: true } }).sort({ name: 1 }).exec();
  }

  findByNameInOrg(
    organizationId: Types.ObjectId,
    name: string,
  ): Promise<DepartmentDocument | null> {
    return this.model.findOne({ organizationId, name, isDeleted: { $ne: true } }).exec();
  }

  /** Idempotent upsert used by the department seeder. */
  async upsert(organizationId: Types.ObjectId, name: string, data: Partial<Department>): Promise<void> {
    await this.model
      .updateOne({ organizationId, name }, { $set: data }, { upsert: true })
      .exec();
  }
}
