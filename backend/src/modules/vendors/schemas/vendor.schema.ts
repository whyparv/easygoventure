import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export type VendorDocument = HydratedDocument<Vendor>;

@Schema({ ...baseSchemaOptions, collection: 'vendors' })
export class Vendor {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  name!: string;

  @Prop({ trim: true })
  contactPerson?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  /** Service category codes the vendor supports, e.g. 'HOTEL', 'VISA'. */
  @Prop({ type: [String], default: [] })
  supportedServices!: string[];

  @Prop({ trim: true })
  paymentTerms?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);

// Tenant-scoped lookups by name.
VendorSchema.index({ organizationId: 1, name: 1 });
