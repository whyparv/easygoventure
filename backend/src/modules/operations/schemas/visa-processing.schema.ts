import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum VisaStatus {
  PENDING_DOCUMENTS = 'PENDING_DOCUMENTS',
  SUBMITTED = 'SUBMITTED',
  PROCESSING = 'PROCESSING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * VisaProcessing — visa-specific operational data embedded on a VISA Booking.
 * Tracks the document → submission → processing → decision milestones that the
 * timeline and risk engines read.
 */
@Schema({ _id: false })
export class VisaProcessing {
  @Prop({ type: Date })
  passportReceivedAt?: Date;

  @Prop({ type: Date })
  applicationSubmittedAt?: Date;

  @Prop({ type: Date })
  processingStartedAt?: Date;

  @Prop({ type: Date })
  approvedAt?: Date;

  @Prop({ type: Date })
  rejectedAt?: Date;

  @Prop({ type: [String], default: [] })
  documents!: string[];

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: String, enum: VisaStatus, default: VisaStatus.PENDING_DOCUMENTS })
  status!: VisaStatus;
}

export const VisaProcessingSchema = SchemaFactory.createForClass(VisaProcessing);
