import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum TransferDetailStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
}

/**
 * TransferBookingDetails — transfer-specific operational data embedded on a
 * TRANSFER Booking (pickup/drop, driver + vehicle assignment).
 */
@Schema({ _id: false })
export class TransferBookingDetails {
  @Prop({ trim: true })
  pickupLocation?: string;

  @Prop({ trim: true })
  dropLocation?: string;

  @Prop({ type: Date })
  pickupTime?: Date;

  @Prop({ trim: true })
  driverName?: string;

  @Prop({ trim: true })
  driverPhone?: string;

  @Prop({ trim: true })
  vehicleType?: string;

  @Prop({ trim: true })
  vehicleNumber?: string;

  @Prop({ type: String, enum: TransferDetailStatus, default: TransferDetailStatus.PENDING })
  status!: TransferDetailStatus;
}

export const TransferBookingDetailsSchema = SchemaFactory.createForClass(TransferBookingDetails);
