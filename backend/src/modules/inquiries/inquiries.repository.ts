import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Inquiry, InquiryDocument } from './schemas/inquiry.schema';

@Injectable()
export class InquiriesRepository extends TenantScopedRepository<InquiryDocument> {
  constructor(@InjectModel(Inquiry.name) model: Model<InquiryDocument>) {
    super(model);
  }

  create(data: Partial<Inquiry>): Promise<InquiryDocument> {
    return this.model.create(data);
  }
}
