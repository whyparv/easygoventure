import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum AiApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type AiApprovalDocument = HydratedDocument<AiApproval>;

/**
 * AiApproval — an immutable record of a human decision on an AI action. This is
 * the audit spine of the human-in-the-loop guarantee: every executed action is
 * traceable to an APPROVED decision and the user who made it.
 */
@Schema({ ...baseSchemaOptions, collection: 'ai_approvals' })
export class AiApproval {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AiAction', required: true, index: true })
  actionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  decidedByUserId!: Types.ObjectId;

  @Prop({ type: String, enum: AiApprovalDecision, required: true })
  decision!: AiApprovalDecision;

  @Prop({ trim: true })
  reason?: string;
}

export const AiApprovalSchema = SchemaFactory.createForClass(AiApproval);
