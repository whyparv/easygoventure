import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export type OrganizationDocument = HydratedDocument<Organization>;

/**
 * Organization — the tenant boundary. Every tenant-owned business record carries
 * an `organizationId` pointing here. This is the root of the multi-tenant model.
 */
@Schema({ ...baseSchemaOptions, collection: 'organizations' })
export class Organization {
  @Prop({ required: true, trim: true })
  name!: string;

  /** URL/tenant-friendly unique key (e.g. "acme-dmc"). */
  @Prop({ required: true, trim: true, lowercase: true, unique: true, index: true })
  slug!: string;

  @Prop({ trim: true })
  logo?: string;

  @Prop({ trim: true, default: 'Asia/Dubai' })
  timezone!: string;

  @Prop({ trim: true, uppercase: true, default: 'USD' })
  currency!: string;

  @Prop({ trim: true, default: 'FREE' })
  subscriptionPlan!: string;

  /** Free-form tenant settings (branding, feature flags, defaults). */
  @Prop({ type: Object, default: {} })
  settings!: Record<string, unknown>;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
