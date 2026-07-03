import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum HotelDetailStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
}

/**
 * HotelBookingDetails — hotel-specific operational data embedded on a HOTEL
 * Booking (the parent Booking IS the supplier confirmation; this carries the
 * stay-level specifics). Derived metrics (`nights`, `roomNights`) are computed,
 * never stored — see `hotelDetailMetrics`.
 */
@Schema({ _id: false })
export class HotelBookingDetails {
  @Prop({ trim: true })
  hotelName?: string;

  @Prop({ type: Date })
  checkInDate?: Date;

  @Prop({ type: Date })
  checkOutDate?: Date;

  @Prop({ type: Number, min: 0, default: 1 })
  roomCount!: number;

  @Prop({ trim: true })
  roomType?: string;

  @Prop({ trim: true })
  confirmationNumber?: string;

  @Prop({ trim: true })
  specialRequests?: string;

  @Prop({ type: String, enum: HotelDetailStatus, default: HotelDetailStatus.PENDING })
  status!: HotelDetailStatus;
}

export const HotelBookingDetailsSchema = SchemaFactory.createForClass(HotelBookingDetails);

/** Derived stay metrics — computed from the check-in/out window and room count. */
export function hotelDetailMetrics(
  details: Pick<HotelBookingDetails, 'checkInDate' | 'checkOutDate' | 'roomCount'> | null | undefined,
): { nights: number; roomNights: number } {
  if (!details?.checkInDate || !details?.checkOutDate) return { nights: 0, roomNights: 0 };
  const ms = new Date(details.checkOutDate).getTime() - new Date(details.checkInDate).getTime();
  const nights = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  const rooms = details.roomCount && details.roomCount > 0 ? details.roomCount : 1;
  return { nights, roomNights: nights * rooms };
}
