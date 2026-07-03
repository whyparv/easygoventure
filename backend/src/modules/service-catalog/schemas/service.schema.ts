import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export type ServiceDocument = HydratedDocument<Service>;

/**
 * A tenant-scoped service offered by an organization (replaces the legacy
 * hard-coded service enums). `categoryCode` references {@link ServiceCategory.code}.
 */
@Schema({ ...baseSchemaOptions, collection: 'services' })
export class Service {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, uppercase: true, index: true })
  categoryCode!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: [String], default: [] })
  requiredFields!: string[];

  @Prop({ type: [String], default: [] })
  requiredDocuments!: string[];

  @Prop({ trim: true })
  defaultTerms?: string;

  /** Human-readable turnaround, e.g. "5 Days". */
  @Prop({ trim: true })
  processingTime?: string;

  @Prop({ type: String, trim: true, uppercase: true, default: 'USD' })
  currency!: string;

  @Prop({ type: Number })
  basePrice?: number;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);

// One organization cannot hold two services with the same name.
ServiceSchema.index({ organizationId: 1, name: 1 });
