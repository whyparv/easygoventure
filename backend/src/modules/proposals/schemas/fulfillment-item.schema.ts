import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';
import { ServiceLineType } from '../../../common/enums/service-line.enum';

export { ServiceLineType };

export enum FulfillmentItemStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export type FulfillmentItemDocument = HydratedDocument<FulfillmentItem>;

/**
 * FulfillmentItem — one operational line derived from a proposal's commercial
 * snapshot (one per PackageItemSnapshot). The proposal's operational progress is
 * derived from the statuses of its fulfillment items.
 */
@Schema({ ...baseSchemaOptions, collection: 'fulfillment_items' })
export class FulfillmentItem {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Proposal', required: true, index: true })
  proposalId!: Types.ObjectId;

  /** The snapshot item this was derived from (frozen reference). */
  @Prop({ trim: true })
  packageItemId?: string;

  @Prop({ type: String, enum: ServiceLineType, required: true })
  type!: ServiceLineType;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ type: Number, default: 1, min: 1 })
  quantity!: number;

  /** Frozen references carried from the snapshot for operational lookup. */
  @Prop({ trim: true })
  referenceId?: string;

  @Prop({ trim: true })
  vendorRateId?: string;

  @Prop({ trim: true })
  vendorName?: string;

  @Prop({
    type: String,
    enum: FulfillmentItemStatus,
    default: FulfillmentItemStatus.PENDING,
    index: true,
  })
  status!: FulfillmentItemStatus;

  /** Vendor booking confirmation reference, once confirmed. */
  @Prop({ trim: true })
  confirmationRef?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const FulfillmentItemSchema = SchemaFactory.createForClass(FulfillmentItem);

FulfillmentItemSchema.index({ organizationId: 1, proposalId: 1 });
