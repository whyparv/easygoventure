import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum AiMessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
}

export type AiMessageDocument = HydratedDocument<AiMessage>;

/** AiMessage — one turn of a copilot conversation (append-only history). */
@Schema({ ...baseSchemaOptions, collection: 'ai_messages' })
export class AiMessage {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AiSession', required: true, index: true })
  sessionId!: Types.ObjectId;

  @Prop({ type: String, enum: AiMessageRole, required: true })
  role!: AiMessageRole;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const AiMessageSchema = SchemaFactory.createForClass(AiMessage);

AiMessageSchema.index({ sessionId: 1, createdAt: 1 });

// 7-day retention to match the session TTL — messages self-purge after a week.
AiMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
