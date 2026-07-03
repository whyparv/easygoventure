import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';
import {
  PackageSnapshot,
  PackageSnapshotSchema,
} from '../../../common/commercial/commercial-snapshot.schema';

// Re-export the shared snapshot types so existing imports from this module keep working.
export {
  PackageSnapshot,
  PackageItemSnapshot,
  VendorRateSnapshot,
} from '../../../common/commercial/commercial-snapshot.schema';

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export type QuotationDocument = HydratedDocument<Quotation>;

/**
 * Quotation — the customer-facing commercial document. It FREEZES the package
 * pricing into an embedded snapshot at generation time; the quotation never
 * changes when future vendor rates change.
 */
@Schema({ ...baseSchemaOptions, collection: 'quotations' })
export class Quotation {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Package', required: true, index: true })
  packageId!: Types.ObjectId;

  /** Human-shareable reference, e.g. QUO-2026-04831. Unique. */
  @Prop({ required: true, trim: true, unique: true, index: true })
  quotationNumber!: string;

  @Prop({ type: Number, default: 1 })
  version!: number;

  @Prop({ type: String, trim: true, uppercase: true, required: true })
  currency!: string;

  /** Frozen customer price (the package total sell price at generation time). */
  @Prop({ type: Number, required: true, min: 0 })
  customerPrice!: number;

  @Prop({ type: Date })
  validUntil?: Date;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: String, enum: QuotationStatus, default: QuotationStatus.DRAFT, index: true })
  status!: QuotationStatus;

  /** The immutable frozen pricing at generation time. */
  @Prop({ type: PackageSnapshotSchema, required: true })
  snapshot!: PackageSnapshot;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Date })
  acceptedAt?: Date;

  /** Who accepted the quotation (contractual acceptance). */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  acceptedBy?: Types.ObjectId | null;

  @Prop({ type: Date })
  rejectedAt?: Date;

  /** Set once this accepted quotation has been converted into a proposal (single-use). */
  @Prop({ type: Types.ObjectId, ref: 'Proposal', default: null, index: true })
  convertedProposalId?: Types.ObjectId | null;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const QuotationSchema = SchemaFactory.createForClass(Quotation);

QuotationSchema.index({ organizationId: 1, status: 1 });
QuotationSchema.index({ organizationId: 1, packageId: 1 });
