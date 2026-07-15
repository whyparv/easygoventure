import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

/** Well-known section keys - extensible; the DB accepts any string. */
export const BRAIN_SECTIONS = [
  'leads',
  'proposals',
  'followups',
  'inquiries',
  'ai_chat',
  'operations',
  'whatsapp_quote_template',
] as const;
export type BrainSection = (typeof BRAIN_SECTIONS)[number] | string;

export type BrainConfigDocument = HydratedDocument<BrainConfig>;

@Schema({ ...baseSchemaOptions, collection: 'brain_configs' })
export class BrainConfig {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  /** Section identifier, e.g. "leads", "proposals". One doc per org+section. */
  @Prop({ required: true, trim: true, index: true })
  section!: string;

  /** Human-readable label shown in UI. Falls back to section key if absent. */
  @Prop({ trim: true })
  label?: string;

  /** The super prompt - injected as a system message for this section's AI calls. */
  @Prop({ trim: true, default: '' })
  prompt!: string;
}

export const BrainConfigSchema = SchemaFactory.createForClass(BrainConfig);

BrainConfigSchema.index({ organizationId: 1, section: 1 }, { unique: true });
