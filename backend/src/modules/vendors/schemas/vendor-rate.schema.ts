import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';
import { ServiceLineType } from '../../../common/enums/service-line.enum';

export { ServiceLineType };

/** Lifecycle of a vendor rate. */
export enum VendorRateStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}

export type VendorRateDocument = HydratedDocument<VendorRate>;

/**
 * VendorRate — a supplier's net cost for a service line over a validity window.
 * The cost source for the package builder / pricing engine. Supports validity
 * windows (seasonal pricing) and pax bands; overlapping ACTIVE windows for the
 * same (vendor, line, target) are validated in the service.
 */
@Schema({ ...baseSchemaOptions, collection: 'vendor_rates' })
export class VendorRate {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendorId!: Types.ObjectId;

  @Prop({ type: String, enum: ServiceLineType, required: true, index: true })
  rateType!: ServiceLineType;

  /** Optional strong link to a catalog Service. */
  @Prop({ type: Types.ObjectId, ref: 'Service', index: true })
  serviceId?: Types.ObjectId;

  /** Optional strong link to a hotel (for HOTEL rates). */
  @Prop({ type: Types.ObjectId, ref: 'HotelCatalog', index: true })
  hotelId?: Types.ObjectId;

  /** Alternative loose link by service category/code. */
  @Prop({ type: String, trim: true, uppercase: true })
  serviceCode?: string;

  @Prop({ type: String, trim: true, uppercase: true, default: 'USD' })
  currency!: string;

  @Prop({ type: Number, required: true, min: 0 })
  netCost!: number;

  /** Pricing unit, e.g. 'per night', 'per person'. */
  @Prop({ trim: true })
  unit?: string;

  @Prop({ type: Number, min: 1 })
  minimumPax?: number;

  @Prop({ type: Number, min: 1 })
  maximumPax?: number;

  @Prop({ type: Date, required: true, index: true })
  validFrom!: Date;

  @Prop({ type: Date, index: true })
  validTo?: Date;

  @Prop({ type: String, enum: VendorRateStatus, default: VendorRateStatus.ACTIVE, index: true })
  status!: VendorRateStatus;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const VendorRateSchema = SchemaFactory.createForClass(VendorRate);

// Tenant-scoped lookups + validity-window / target queries.
VendorRateSchema.index({ organizationId: 1, vendorId: 1 });
VendorRateSchema.index({ organizationId: 1, hotelId: 1 });
VendorRateSchema.index({ organizationId: 1, rateType: 1, status: 1 });
VendorRateSchema.index({ validFrom: 1, validTo: 1 });
