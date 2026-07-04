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

  /** Stable business code, e.g. "DXB-VISA-96H". Optional. */
  @Prop({ trim: true, uppercase: true })
  code?: string;

  /**
   * Destination this service is sold for. Dubai today; the catalog is destination-
   * scoped so Thailand/Singapore/etc. can be added later without redesign.
   */
  @Prop({ trim: true, default: 'Dubai', index: true })
  destination!: string;

  /** Optional sub-type within a category, e.g. "Tourist Visa", "Shared Transfer". */
  @Prop({ trim: true })
  serviceType?: string;

  /**
   * Groups service VARIANTS under a generic requirement label, e.g. the variants
   * "Shared/Private/Luxury Airport Transfer" all share variantGroup "Airport
   * Transfer". A generic inquiry requirement ("Airport Transfer") maps to a group;
   * staff then pick a specific variant. Standalone services leave this empty.
   * (A future AI can rank the variants in a group by serviceType + cost/sell.)
   */
  @Prop({ trim: true, index: true })
  variantGroup?: string;

  @Prop({ trim: true })
  description?: string;

  /** Preferred supplier / vendor name for this service. */
  @Prop({ trim: true })
  supplier?: string;

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

  /** Legacy single price — retained for back-compat; prefer cost/sell below. */
  @Prop({ type: Number })
  basePrice?: number;

  /** Net cost from the supplier. */
  @Prop({ type: Number, min: 0 })
  costPrice?: number;

  /** Default price sold to the agency (margin = defaultSellPrice − costPrice). */
  @Prop({ type: Number, min: 0 })
  defaultSellPrice?: number;

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
// Destination-scoped catalog browsing (the lead service picker filters by destination).
ServiceSchema.index({ organizationId: 1, destination: 1, categoryCode: 1, isActive: 1 });
