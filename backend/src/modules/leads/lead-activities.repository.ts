import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, FilterQuery, Model, Types } from 'mongoose';
import {
  LeadActivity,
  LeadActivityDocument,
  LeadActivityType,
} from './schemas/lead-activity.schema';

export interface CreateActivityInput {
  organizationId: string | Types.ObjectId;
  leadId: string;
  type: LeadActivityType;
  description: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LeadActivitiesRepository {
  constructor(
    @InjectModel(LeadActivity.name) private readonly model: Model<LeadActivityDocument>,
  ) {}

  create(
    input: CreateActivityInput,
    session?: ClientSession,
  ): Promise<LeadActivityDocument> {
    return new this.model({
      organizationId:
        input.organizationId instanceof Types.ObjectId
          ? input.organizationId
          : new Types.ObjectId(input.organizationId),
      leadId: new Types.ObjectId(input.leadId),
      type: input.type,
      description: input.description,
      metadata: input.metadata,
    }).save({ session });
  }

  findByLead(
    leadId: string,
    tenant: FilterQuery<LeadActivityDocument> = {},
  ): Promise<LeadActivityDocument[]> {
    return this.model
      .find({ leadId: new Types.ObjectId(leadId), ...tenant, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .exec();
  }
}
