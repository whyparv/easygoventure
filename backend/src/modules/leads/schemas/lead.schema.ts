import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum LeadSource {
  WHATSAPP = 'WHATSAPP',
  MANUAL = 'MANUAL',
  EMAIL = 'EMAIL',
}

export enum InquiryType {
  VISA = 'VISA',
  TRAVEL_PACKAGE = 'TRAVEL_PACKAGE',
  HOTEL = 'HOTEL',
  TRANSFER = 'TRANSFER',
  CUSTOM = 'CUSTOM',
}

export enum LeadStatus {
  NEW = 'NEW',
  PROPOSAL_SENT = 'PROPOSAL_SENT',
  AWAITING_RESPONSE = 'AWAITING_RESPONSE',
  FOLLOW_UP = 'FOLLOW_UP',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export type LeadDocument = HydratedDocument<Lead>;

@Schema({ ...baseSchemaOptions, collection: 'leads' })
export class Lead {
  /** Tenant owner. Added in the Phase 1.5 tenant-isolation pass. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  phone!: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  companyName?: string;

  @Prop({ type: String, enum: LeadSource, default: LeadSource.WHATSAPP })
  source!: LeadSource;

  @Prop({ type: String, enum: InquiryType, required: true })
  inquiryType!: InquiryType;

  @Prop({ type: String, enum: LeadStatus, default: LeadStatus.NEW, index: true })
  status!: LeadStatus;

  @Prop({ trim: true })
  notes?: string;

  /** Raw inbound message (WhatsApp/email) the lead was created from. */
  @Prop({ trim: true })
  rawInquiry?: string;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

// Tenant-scoped query paths.
LeadSchema.index({ organizationId: 1, status: 1 });
LeadSchema.index({ organizationId: 1, createdAt: -1 });
