import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

/**
 * Lifecycle of an AI-recommended action. Human approval is MANDATORY: an action
 * can never move to EXECUTED without an APPROVED decision first. The backend
 * never performs autonomous writes — it records the lifecycle only.
 */
export enum AiActionStatus {
  RECOMMENDED = 'RECOMMENDED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
}

export type AiActionDocument = HydratedDocument<AiAction>;

@Schema({ ...baseSchemaOptions, collection: 'ai_actions' })
export class AiAction {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AiSession', default: null, index: true })
  sessionId?: Types.ObjectId | null;

  /** The user the recommendation is presented to / who owns it. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  /** e.g. create_followup | add_note | update_status | create_proposal | custom. */
  @Prop({ required: true, trim: true })
  type!: string;

  @Prop({ required: true, trim: true })
  summary!: string;

  /** Proposed, validated action fields (never executed autonomously). */
  @Prop({ type: Object, default: {} })
  payload!: Record<string, unknown>;

  @Prop({ trim: true })
  targetEntity?: string;

  @Prop({ trim: true })
  targetId?: string;

  @Prop({ type: String, enum: AiActionStatus, default: AiActionStatus.RECOMMENDED, index: true })
  status!: AiActionStatus;

  @Prop({ type: Date })
  executedAt?: Date;

  @Prop({ type: Object })
  executionResult?: Record<string, unknown>;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const AiActionSchema = SchemaFactory.createForClass(AiAction);

AiActionSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
