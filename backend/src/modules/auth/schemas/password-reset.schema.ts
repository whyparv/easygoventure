import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export type PasswordResetDocument = HydratedDocument<PasswordReset>;

/**
 * PasswordReset — a single-use, time-boxed password-reset grant.
 *
 * Stores only the token hash. The raw token is delivered to the user (email
 * delivery is a later phase; in Phase 1 the token is returned/logged) and
 * exchanged once for a new password. Expired documents auto-purge via TTL.
 */
@Schema({ ...baseSchemaOptions, collection: 'password_resets' })
export class PasswordReset {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  tokenHash!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  usedAt?: Date | null;
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);

// TTL — Mongo removes the document once expiresAt passes.
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
