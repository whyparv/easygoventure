import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';
import {
  HotelBookingDetails,
  HotelBookingDetailsSchema,
} from './hotel-booking-details.schema';
import {
  TransferBookingDetails,
  TransferBookingDetailsSchema,
} from './transfer-booking-details.schema';
import { VisaProcessing, VisaProcessingSchema } from './visa-processing.schema';

/** The supplier line a booking represents. Mirrors ServiceLineType (minus CUSTOM). */
export enum BookingType {
  HOTEL = 'HOTEL',
  ACTIVITY = 'ACTIVITY',
  TRANSFER = 'TRANSFER',
  VISA = 'VISA',
  FLIGHT = 'FLIGHT',
}

/** Supplier-confirmation lifecycle. */
export enum BookingStatus {
  PENDING = 'PENDING',
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export type BookingDocument = HydratedDocument<Booking>;

/**
 * Booking — a supplier confirmation for one operational line of a booked
 * proposal. Type-specific operational data lives in an embedded sub-document
 * matching `bookingType` (hotel / transfer / visa); activity & flight bookings
 * use the common fields. Optionally linked to the `FulfillmentItem` it satisfies.
 */
@Schema({ ...baseSchemaOptions, collection: 'operations_bookings' })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Proposal', required: true, index: true })
  proposalId!: Types.ObjectId;

  /** The fulfillment line this booking satisfies (optional link). */
  @Prop({ type: Types.ObjectId, ref: 'FulfillmentItem', default: null, index: true })
  fulfillmentItemId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', default: null, index: true })
  vendorId?: Types.ObjectId | null;

  @Prop({ type: String, enum: BookingType, required: true, index: true })
  bookingType!: BookingType;

  /** Our booking reference. */
  @Prop({ trim: true })
  bookingReference?: string;

  /** The supplier's confirmation reference. */
  @Prop({ trim: true })
  supplierReference?: string;

  @Prop({ type: Date })
  confirmationDate?: Date;

  /** The primary date this line occurs (check-in / pickup / activity / flight). */
  @Prop({ type: Date, index: true })
  travelDate?: Date;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: String, enum: BookingStatus, default: BookingStatus.PENDING, index: true })
  status!: BookingStatus;

  // ── Type-specific operational details (only the one matching bookingType is set)
  @Prop({ type: HotelBookingDetailsSchema, default: null })
  hotelDetails?: HotelBookingDetails | null;

  @Prop({ type: TransferBookingDetailsSchema, default: null })
  transferDetails?: TransferBookingDetails | null;

  @Prop({ type: VisaProcessingSchema, default: null })
  visaProcessing?: VisaProcessing | null;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

BookingSchema.index({ organizationId: 1, proposalId: 1 });
BookingSchema.index({ organizationId: 1, status: 1 });
BookingSchema.index({ organizationId: 1, vendorId: 1 });
BookingSchema.index({ organizationId: 1, travelDate: 1 });
BookingSchema.index({ organizationId: 1, bookingType: 1, status: 1 });
