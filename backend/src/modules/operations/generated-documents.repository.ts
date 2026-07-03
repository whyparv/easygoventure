import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { GeneratedDocument, GeneratedDocumentDocument } from './schemas/generated-document.schema';

@Injectable()
export class GeneratedDocumentsRepository extends TenantScopedRepository<GeneratedDocumentDocument> {
  constructor(@InjectModel(GeneratedDocument.name) model: Model<GeneratedDocumentDocument>) {
    super(model);
  }

  create(data: Partial<GeneratedDocument>): Promise<GeneratedDocumentDocument> {
    return this.model.create(data);
  }

  /** All non-deleted generated-document metadata records for a proposal. */
  findByProposal(
    scope: FilterQuery<GeneratedDocumentDocument>,
    proposalId: Types.ObjectId,
  ): Promise<GeneratedDocumentDocument[]> {
    return this.model
      .find({ ...scope, proposalId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .exec();
  }
}
