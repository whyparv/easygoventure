import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum InquirySource {
  WHATSAPP = 'WHATSAPP',
  MANUAL = 'MANUAL',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
}

/**
 * Inquiry lifecycle. The Inquiry is the new first-class entry point of the
 * pipeline; a Lead becomes a downstream sales artifact created on conversion.
 */
export enum InquiryStatus {
  DRAFT = 'DRAFT',
  COLLECTING_INFORMATION = 'COLLECTING_INFORMATION',
  READY_FOR_PRICING = 'READY_FOR_PRICING',
  QUOTED = 'QUOTED',
  CONVERTED = 'CONVERTED',
  CANCELLED = 'CANCELLED',
}

export type InquiryDocument = HydratedDocument<Inquiry>;

@Schema({ ...baseSchemaOptions, collection: 'inquiries' })
export class Inquiry {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  /** Human-friendly unique reference, e.g. INQ-2026-04831. */
  @Prop({ required: true, trim: true, unique: true, index: true })
  referenceNo!: string;

  @Prop({ type: String, enum: InquirySource, default: InquirySource.MANUAL })
  source!: InquirySource;

  @Prop({ type: String, enum: InquiryStatus, default: InquiryStatus.DRAFT, index: true })
  status!: InquiryStatus;

  @Prop({ required: true, trim: true })
  customerName!: string;

  @Prop({ trim: true })
  customerPhone?: string;

  @Prop({ trim: true, lowercase: true })
  customerEmail?: string;

  @Prop({ trim: true })
  companyName?: string;

  @Prop({ trim: true })
  destination?: string;

  /** References a ServiceCategory.code (VISA, HOTEL, …); data-driven, not an enum. */
  @Prop({ trim: true, uppercase: true })
  serviceCategoryCode?: string;

  @Prop({ type: Number, min: 1, max: 100 })
  travelers?: number;

  @Prop({ type: Date })
  travelDate?: Date;

  @Prop({ type: Number, min: 0 })
  budget?: number;

  /** Raw inbound message the inquiry was created from (WhatsApp/email/etc.). */
  @Prop({ trim: true })
  rawInquiry?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  assignedToUserId?: Types.ObjectId | null;

  /** Set when the inquiry is converted into a downstream Lead. */
  @Prop({ type: Types.ObjectId, ref: 'Lead', default: null })
  convertedLeadId?: Types.ObjectId | null;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const InquirySchema = SchemaFactory.createForClass(Inquiry);

InquirySchema.index({ organizationId: 1, status: 1 });
