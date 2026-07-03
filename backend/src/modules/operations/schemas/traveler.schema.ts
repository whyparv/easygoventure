import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum TravelerStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

export enum TravelerGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  UNSPECIFIED = 'UNSPECIFIED',
}

export type TravelerDocument = HydratedDocument<Traveler>;

/**
 * Traveler — a real person travelling under a booked proposal.
 *
 * A proposal may carry many travelers. Travelers stay linked to the proposal
 * (and therefore to its frozen commercial snapshot) via `proposalId`, so the
 * operational manifest always reconciles against the accepted commercial terms.
 * Soft-delete only (a cancelled traveler is retained for audit/manifest history).
 */
@Schema({ ...baseSchemaOptions, collection: 'travelers' })
export class Traveler {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Proposal', required: true, index: true })
  proposalId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ type: String, enum: TravelerGender, default: TravelerGender.UNSPECIFIED })
  gender!: TravelerGender;

  @Prop({ type: Date })
  dateOfBirth?: Date;

  @Prop({ trim: true })
  nationality?: string;

  @Prop({ trim: true, index: true })
  passportNumber?: string;

  @Prop({ type: Date })
  passportExpiry?: Date;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: String, enum: TravelerStatus, default: TravelerStatus.ACTIVE, index: true })
  status!: TravelerStatus;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const TravelerSchema = SchemaFactory.createForClass(Traveler);

TravelerSchema.index({ organizationId: 1, proposalId: 1 });
TravelerSchema.index({ organizationId: 1, passportNumber: 1 });
