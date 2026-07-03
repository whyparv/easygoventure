import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum LeadActivityType {
  LEAD_CREATED = 'LEAD_CREATED',
  LEAD_UPDATED = 'LEAD_UPDATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  NOTE_ADDED = 'NOTE_ADDED',
  PROPOSAL_CREATED = 'PROPOSAL_CREATED',
  PROPOSAL_SENT = 'PROPOSAL_SENT',
  PROPOSAL_VIEWED = 'PROPOSAL_VIEWED',
  PROPOSAL_ACCEPTED = 'PROPOSAL_ACCEPTED',
  PROPOSAL_REJECTED = 'PROPOSAL_REJECTED',
  FOLLOW_UP_SCHEDULED = 'FOLLOW_UP_SCHEDULED',
  FOLLOW_UP_COMPLETED = 'FOLLOW_UP_COMPLETED',
  FULFILLMENT_CREATED = 'FULFILLMENT_CREATED',
  FULFILLMENT_UPDATED = 'FULFILLMENT_UPDATED',
}

export type LeadActivityDocument = HydratedDocument<LeadActivity>;

@Schema({ ...baseSchemaOptions, collection: 'lead_activities' })
export class LeadActivity {
  /** Tenant owner. Added in the Phase 1.5 tenant-isolation pass. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true, index: true })
  leadId!: Types.ObjectId;

  @Prop({ type: String, enum: LeadActivityType, required: true })
  type!: LeadActivityType;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const LeadActivitySchema = SchemaFactory.createForClass(LeadActivity);

LeadActivitySchema.index({ organizationId: 1, leadId: 1, createdAt: -1 });
