import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export type SessionDocument = HydratedDocument<Session>;

/**
 * Session — tracks an issued refresh token (device/session).
 *
 * Only the SHA-256 hash of the refresh token is stored, so a DB leak cannot be
 * replayed. Sessions enable rotation on refresh, remote logout, and device
 * tracking. Expired documents are auto-purged by a TTL index on `expiresAt`.
 */
@Schema({ ...baseSchemaOptions, collection: 'auth_sessions' })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null, index: true })
  organizationId!: Types.ObjectId | null;

  @Prop({ required: true, unique: true, index: true })
  refreshTokenHash!: string;

  @Prop({ trim: true })
  userAgent?: string;

  @Prop({ trim: true })
  ip?: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: Date, default: null })
  revokedAt?: Date | null;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// TTL — Mongo removes the document once expiresAt passes.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
