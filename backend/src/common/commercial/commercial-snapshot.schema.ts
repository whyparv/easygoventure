import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Immutable commercial pricing snapshots, shared by Quotation and Proposal.
 *
 * Once written these are NEVER modified — later edits to vendors, rates, hotels,
 * services or the source package do not touch a historical quotation or a
 * converted proposal. Ids are stored as strings (frozen references, not joins).
 */
@Schema({ _id: false })
export class VendorRateSnapshot {
  @Prop() vendorRateId?: string;
  @Prop() vendorId?: string;
  @Prop() vendorName?: string;
  @Prop() rateType?: string;
  @Prop() currency?: string;
  @Prop({ type: Number }) netCost?: number;
  @Prop({ type: Date }) validFrom?: Date;
  @Prop({ type: Date }) validTo?: Date;
}
export const VendorRateSnapshotSchema = SchemaFactory.createForClass(VendorRateSnapshot);

@Schema({ _id: false })
export class PackageItemSnapshot {
  @Prop({ required: true }) itemId!: string;
  @Prop({ required: true }) type!: string;
  @Prop({ required: true }) description!: string;
  @Prop({ type: Number, required: true }) quantity!: number;
  @Prop({ type: Number, required: true }) unitCost!: number;
  @Prop({ type: Number, required: true }) unitSellPrice!: number;
  @Prop({ required: true }) markupType!: string;
  @Prop({ type: Number, required: true }) markupValue!: number;
  @Prop({ type: Number, required: true }) totalCost!: number;
  @Prop({ type: Number, required: true }) totalSellPrice!: number;
  @Prop({ type: Number, required: true }) profit!: number;
  @Prop({ type: VendorRateSnapshotSchema, default: null }) vendorRate?: VendorRateSnapshot | null;
}
export const PackageItemSnapshotSchema = SchemaFactory.createForClass(PackageItemSnapshot);

@Schema({ _id: false })
export class PackageSnapshot {
  @Prop({ required: true }) packageId!: string;
  @Prop({ required: true }) name!: string;
  @Prop() destination?: string;
  @Prop({ type: Date }) travelStartDate?: Date;
  @Prop({ type: Date }) travelEndDate?: Date;
  @Prop({ type: Number, required: true }) numberOfTravelers!: number;
  @Prop({ required: true }) currency!: string;
  @Prop({ type: Number, required: true }) totalCost!: number;
  @Prop({ type: Number, required: true }) totalMarkup!: number;
  @Prop({ type: Number, required: true }) totalSellPrice!: number;
  @Prop({ type: Number, required: true }) expectedProfit!: number;
  @Prop({ type: [PackageItemSnapshotSchema], default: [] }) items!: PackageItemSnapshot[];
}
export const PackageSnapshotSchema = SchemaFactory.createForClass(PackageSnapshot);
