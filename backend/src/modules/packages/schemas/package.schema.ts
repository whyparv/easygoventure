import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum PackageStatus {
  DRAFT = 'DRAFT',
  COSTED = 'COSTED',
  QUOTED = 'QUOTED',
  ARCHIVED = 'ARCHIVED',
}

export type PackageDocument = HydratedDocument<Package>;

/**
 * Package — the INTERNAL costing workspace (not customer-facing). Holds the trip
 * shape plus derived totals. Every total is computed by the PricingEngine from
 * the package's items; there are no manually-entered totals.
 */
@Schema({ ...baseSchemaOptions, collection: 'packages' })
export class Package {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Inquiry', default: null, index: true })
  inquiryId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  destination?: string;

  @Prop({ type: Date })
  travelStartDate?: Date;

  @Prop({ type: Date })
  travelEndDate?: Date;

  @Prop({ type: Number, default: 1, min: 1, max: 100 })
  numberOfTravelers!: number;

  @Prop({ type: String, trim: true, uppercase: true, default: 'USD' })
  currency!: string;

  @Prop({ type: String, enum: PackageStatus, default: PackageStatus.DRAFT, index: true })
  status!: PackageStatus;

  // ── Derived totals (owned by the PricingEngine) ────────────────────────
  @Prop({ type: Number, default: 0 })
  totalCost!: number;

  @Prop({ type: Number, default: 0 })
  totalMarkup!: number;

  @Prop({ type: Number, default: 0 })
  totalSellPrice!: number;

  @Prop({ type: Number, default: 0 })
  expectedProfit!: number;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const PackageSchema = SchemaFactory.createForClass(Package);

PackageSchema.index({ organizationId: 1, status: 1 });
PackageSchema.index({ organizationId: 1, inquiryId: 1 });
