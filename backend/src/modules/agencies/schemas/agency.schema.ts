import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export type AgencyDocument = HydratedDocument<Agency>;

@Schema({ ...baseSchemaOptions, collection: 'agencies' })
export class Agency {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  name!: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  contactPerson?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ trim: true })
  country?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  website?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const AgencySchema = SchemaFactory.createForClass(Agency);

// Tenant-scoped lookups by name.
AgencySchema.index({ organizationId: 1, name: 1 });
