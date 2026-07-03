import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum FulfillmentType {
  VISA = 'VISA',
  TRAVEL_PACKAGE = 'TRAVEL_PACKAGE',
  HOTEL = 'HOTEL',
  TRANSFER = 'TRANSFER',
  CUSTOM = 'CUSTOM',
}

export enum FulfillmentStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_CUSTOMER = 'WAITING_CUSTOMER',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export type FulfillmentDocument = HydratedDocument<Fulfillment>;

@Schema({ ...baseSchemaOptions, collection: 'fulfillments' })
export class Fulfillment {
  /** Tenant owner. Added in the Phase 1.5 tenant-isolation pass. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true, index: true })
  leadId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Proposal', index: true })
  proposalId?: Types.ObjectId;

  @Prop({ type: String, enum: FulfillmentType, required: true })
  type!: FulfillmentType;

  @Prop({ type: String, enum: FulfillmentStatus, default: FulfillmentStatus.PENDING, index: true })
  status!: FulfillmentStatus;

  @Prop({ trim: true })
  remarks?: string;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const FulfillmentSchema = SchemaFactory.createForClass(Fulfillment);

FulfillmentSchema.index({ organizationId: 1, status: 1 });
FulfillmentSchema.index({ organizationId: 1, leadId: 1 });
