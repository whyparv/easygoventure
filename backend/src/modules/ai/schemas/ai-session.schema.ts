import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum AiSessionStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export type AiSessionDocument = HydratedDocument<AiSession>;

/**
 * AiSession — a conversational memory container for the copilot. Holds a snapshot
 * of the CRM context the assistant was grounded in, so the conversation stays
 * about a specific inquiry/lead/deal.
 */
@Schema({ ...baseSchemaOptions, collection: 'ai_sessions' })
export class AiSession {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ trim: true })
  title?: string;

  /** e.g. "Inquiry", "Lead", "Proposal". */
  @Prop({ trim: true })
  contextType?: string;

  @Prop({ trim: true })
  contextId?: string;

  /** Snapshot of the record the assistant is grounded in. */
  @Prop({ type: Object })
  contextSnapshot?: Record<string, unknown>;

  @Prop({ type: String, enum: AiSessionStatus, default: AiSessionStatus.ACTIVE, index: true })
  status!: AiSessionStatus;

  @Prop({ type: Date })
  lastMessageAt?: Date;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const AiSessionSchema = SchemaFactory.createForClass(AiSession);

// 7-day retention: a conversation is purged 7 days after its last activity
// (`updatedAt` bumps on every new message), per the AI history policy.
AiSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
