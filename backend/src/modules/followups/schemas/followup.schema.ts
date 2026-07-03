import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum FollowUpOutcome {
  NO_RESPONSE = 'NO_RESPONSE',
  POSITIVE = 'POSITIVE',
  NEEDS_CHANGES = 'NEEDS_CHANGES',
  REJECTED = 'REJECTED',
  ACCEPTED = 'ACCEPTED',
}

export type FollowUpDocument = HydratedDocument<FollowUp>;

@Schema({ ...baseSchemaOptions, collection: 'followups' })
export class FollowUp {
  /** Tenant owner. Added in the Phase 1.5 tenant-isolation pass. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true, index: true })
  leadId!: Types.ObjectId;

  @Prop({ type: Date, required: true, index: true })
  scheduledDate!: Date;

  @Prop({ trim: true })
  remarks?: string;

  /** Set once the follow-up has been carried out. */
  @Prop({ type: String, enum: FollowUpOutcome })
  outcome?: FollowUpOutcome;

  @Prop({ trim: true })
  nextAction?: string;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const FollowUpSchema = SchemaFactory.createForClass(FollowUp);

FollowUpSchema.index({ organizationId: 1, scheduledDate: 1 });
FollowUpSchema.index({ organizationId: 1, leadId: 1 });
