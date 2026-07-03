import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum DocumentType {
  TRAVEL_VOUCHER = 'TRAVEL_VOUCHER',
  FINAL_ITINERARY = 'FINAL_ITINERARY',
  TRAVELER_MANIFEST = 'TRAVELER_MANIFEST',
  BOOKING_SUMMARY = 'BOOKING_SUMMARY',
  OPERATIONAL_BRIEF = 'OPERATIONAL_BRIEF',
}

export type GeneratedDocumentDocument = HydratedDocument<GeneratedDocument>;

/**
 * GeneratedDocument — METADATA ONLY for a generated travel document. The binary
 * (PDF) is never stored in MongoDB; we persist provenance (who/when/what), a
 * content hash for integrity, and an optional external `storageRef` (e.g. an S3
 * URI) so the artifact can be regenerated or fetched deterministically.
 */
@Schema({ ...baseSchemaOptions, collection: 'generated_documents' })
export class GeneratedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Proposal', required: true, index: true })
  proposalId!: Types.ObjectId;

  @Prop({ type: String, enum: DocumentType, required: true, index: true })
  type!: DocumentType;

  @Prop({ required: true, trim: true })
  title!: string;

  /** Rendering format the metadata describes (no binary stored here). */
  @Prop({ trim: true, default: 'application/json' })
  format!: string;

  /** SHA-256 of the generated content, for integrity/change detection. */
  @Prop({ trim: true })
  checksum?: string;

  /** External storage pointer (e.g. object-store URI). Never the binary itself. */
  @Prop({ trim: true })
  storageRef?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  generatedBy?: Types.ObjectId | null;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const GeneratedDocumentSchema = SchemaFactory.createForClass(GeneratedDocument);

GeneratedDocumentSchema.index({ organizationId: 1, proposalId: 1, type: 1 });
