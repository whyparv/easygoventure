import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';
import { ServiceLineType } from '../../../common/enums/service-line.enum';

export { ServiceLineType };

export enum MarkupType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export type PackageItemDocument = HydratedDocument<PackageItem>;

/**
 * PackageItem — one priced line inside a Package (a hotel, activity, transfer,
 * visa, flight or custom service). The client supplies the cost + markup config;
 * `unitSellPrice`, `totalCost`, `totalSellPrice` and `profit` are DERIVED by the
 * PricingEngine (never entered manually).
 */
@Schema({ ...baseSchemaOptions, collection: 'package_items' })
export class PackageItem {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Package', required: true, index: true })
  packageId!: Types.ObjectId;

  @Prop({ type: String, enum: ServiceLineType, required: true })
  type!: ServiceLineType;

  /** Loose reference to the underlying entity (hotel/service/etc.) for traceability. */
  @Prop({ type: Types.ObjectId, default: null })
  referenceId?: Types.ObjectId | null;

  /** The vendor rate this cost was sourced from (for traceability + snapshotting). */
  @Prop({ type: Types.ObjectId, ref: 'VendorRate', default: null, index: true })
  vendorRateId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ type: Number, default: 1, min: 1 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0 })
  unitCost!: number;

  @Prop({ type: String, enum: MarkupType, default: MarkupType.PERCENTAGE })
  markupType!: MarkupType;

  @Prop({ type: Number, default: 0, min: 0 })
  markupValue!: number;

  // ── Derived (owned by the PricingEngine) ───────────────────────────────
  @Prop({ type: Number, default: 0 })
  unitSellPrice!: number;

  @Prop({ type: Number, default: 0 })
  totalCost!: number;

  @Prop({ type: Number, default: 0 })
  totalSellPrice!: number;

  @Prop({ type: Number, default: 0 })
  profit!: number;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const PackageItemSchema = SchemaFactory.createForClass(PackageItem);

PackageItemSchema.index({ organizationId: 1, packageId: 1 });
