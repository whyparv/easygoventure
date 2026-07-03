import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, UpdateQuery } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Organization, OrganizationDocument } from './schemas/organization.schema';

@Injectable()
export class OrganizationsRepository extends TenantScopedRepository<OrganizationDocument> {
  constructor(@InjectModel(Organization.name) model: Model<OrganizationDocument>) {
    super(model);
  }

  create(data: Partial<Organization>, session?: ClientSession): Promise<OrganizationDocument> {
    return this.model.create([data], { session }).then((docs) => docs[0]);
  }

  /**
   * Read an organization by id. The Organization collection IS the tenant root, so
   * access is an identity/authorization concern (`_id === actor.organizationId` for
   * non-super), enforced by the service (`assertCanAccess`) rather than an
   * `organizationId` data filter.
   */
  findById(id: string): Promise<OrganizationDocument | null> {
    return this.model.findOne({ _id: id, isDeleted: { $ne: true } }).exec();
  }

  findBySlug(slug: string): Promise<OrganizationDocument | null> {
    return this.model.findOne({ slug, isDeleted: { $ne: true } }).exec();
  }

  /** Soft delete also deactivates the tenant; scoped so it can only hit the intended org. */
  override softDeleteScoped(
    id: string,
    scope: FilterQuery<OrganizationDocument> = {},
  ): Promise<OrganizationDocument | null> {
    const update = {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false,
    } as UpdateQuery<OrganizationDocument>;
    return this.model.findOneAndUpdate({ _id: id, ...scope }, update, { new: true }).exec();
  }
}
