import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Agency, AgencyDocument } from './schemas/agency.schema';

@Injectable()
export class AgenciesRepository extends TenantScopedRepository<AgencyDocument> {
  constructor(@InjectModel(Agency.name) model: Model<AgencyDocument>) {
    super(model);
  }

  create(data: Partial<Agency>): Promise<AgencyDocument> {
    return this.model.create(data);
  }

  findOne(filter: FilterQuery<AgencyDocument>): Promise<AgencyDocument | null> {
    return this.model.findOne(filter).exec();
  }
}
