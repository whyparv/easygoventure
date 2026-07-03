import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';
import {
  PackageSnapshot,
  PackageSnapshotSchema,
} from '../../../common/commercial/commercial-snapshot.schema';

export enum ProposalType {
  VISA = 'VISA',
  TRAVEL_PACKAGE = 'TRAVEL_PACKAGE',
  HOTEL = 'HOTEL',
  CUSTOM = 'CUSTOM',
}

/** Sales lifecycle (legacy lead-based proposals + commercial acceptance). */
export enum ProposalStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

/**
 * Operational (booking) lifecycle — added in Phase 2.1. Runs alongside the sales
 * `status`; a converted proposal is `status: ACCEPTED` (commercial) and advances
 * its `bookingStatus` through the operational stages.
 */
export enum ProposalBookingStatus {
  NOT_READY = 'NOT_READY',
  READY_FOR_BOOKING = 'READY_FOR_BOOKING',
  BOOKED = 'BOOKED',
  FULFILLING = 'FULFILLING',
  COMPLETED = 'COMPLETED',
}

export type ProposalDocument = HydratedDocument<Proposal>;

@Schema({ ...baseSchemaOptions, collection: 'proposals' })
export class Proposal {
  /** Tenant owner. Added in the Phase 1.5 tenant-isolation pass. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  /**
   * Optional as of Phase 2.1: legacy proposals originate from a lead; commercial
   * proposals originate from an accepted quotation (lead resolved via the inquiry
   * when available).
   */
  @Prop({ type: Types.ObjectId, ref: 'Lead', default: null, index: true })
  leadId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: String, enum: ProposalType, required: true })
  proposalType!: ProposalType;

  @Prop({ type: Number, default: 0, min: 0 })
  amount!: number;

  @Prop({ type: String, default: 'USD', uppercase: true, trim: true })
  currency!: string;

  @Prop({ type: String, enum: ProposalStatus, default: ProposalStatus.DRAFT, index: true })
  status!: ProposalStatus;

  /** Human-shareable reference, e.g. PRP-2026-83929. Unique. */
  @Prop({ required: true, unique: true, index: true })
  generatedToken!: string;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ trim: true })
  notes?: string;

  // ── Commercial lineage (Phase 2.1) ─────────────────────────────────────
  @Prop({ type: Types.ObjectId, ref: 'Inquiry', default: null, index: true })
  inquiryId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Package', default: null, index: true })
  packageId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Quotation', default: null, index: true })
  quotationId?: Types.ObjectId | null;

  @Prop({ trim: true })
  quotationNumber?: string;

  @Prop({ type: Number })
  quotationVersion?: number;

  /** Frozen commercial terms copied from the accepted quotation snapshot. */
  @Prop({ type: PackageSnapshotSchema, default: null })
  commercialSnapshot?: PackageSnapshot | null;

  @Prop({ type: Number })
  acceptedPrice?: number;

  @Prop({ type: Date })
  acceptedDate?: Date;

  // ── Operational (booking) lifecycle (Phase 2.1) ────────────────────────
  @Prop({
    type: String,
    enum: ProposalBookingStatus,
    default: ProposalBookingStatus.NOT_READY,
    index: true,
  })
  bookingStatus!: ProposalBookingStatus;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const ProposalSchema = SchemaFactory.createForClass(Proposal);

ProposalSchema.index({ organizationId: 1, status: 1 });
ProposalSchema.index({ organizationId: 1, leadId: 1 });
ProposalSchema.index({ organizationId: 1, bookingStatus: 1 });
ProposalSchema.index({ organizationId: 1, quotationId: 1 });
