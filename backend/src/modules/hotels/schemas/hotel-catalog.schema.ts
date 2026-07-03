import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export type HotelCatalogDocument = HydratedDocument<HotelCatalog>;

/**
 * HotelCatalog — a curated reference catalog of hotels the DMC books into.
 *
 * This is intentionally GLOBAL reference data (no `organizationId`): a Dubai
 * hotel list is shared across tenants, not owned by one. Vendor-specific pricing
 * and availability live on the (tenant-scoped) vendor/rate models, not here.
 *
 * Records are produced offline by the hotel-catalog pipeline and imported by the
 * idempotent HotelCatalogSeeder, keyed on `name + city`.
 */
@Schema({ ...baseSchemaOptions, collection: 'hotel_catalog' })
export class HotelCatalog {
  @Prop({ required: true, trim: true, index: true })
  name!: string;

  /** Fixed category for this collection; mirrors the service-catalog "HOTEL" category. */
  @Prop({ required: true, trim: true, default: 'HOTEL', uppercase: true })
  category!: string;

  @Prop({ type: Number, enum: [3, 4, 5], required: true, index: true })
  starRating!: number;

  @Prop({ trim: true })
  area?: string;

  @Prop({ required: true, trim: true, default: 'Dubai', index: true })
  city!: string;

  @Prop({ required: true, trim: true, default: 'UAE' })
  country!: string;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const HotelCatalogSchema = SchemaFactory.createForClass(HotelCatalog);

// Idempotency / integrity: one document per (name, city). The seeder upserts on
// this exact key so re-running the seed never creates duplicates.
HotelCatalogSchema.index({ name: 1, city: 1 }, { unique: true });
