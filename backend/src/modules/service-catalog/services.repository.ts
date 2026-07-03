import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Service, ServiceDocument } from './schemas/service.schema';

@Injectable()
export class ServicesRepository extends TenantScopedRepository<ServiceDocument> {
  constructor(@InjectModel(Service.name) model: Model<ServiceDocument>) {
    super(model);
  }

  create(data: Partial<Service>): Promise<ServiceDocument> {
    return this.model.create(data);
  }
}
