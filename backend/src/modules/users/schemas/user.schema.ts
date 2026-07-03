import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  SUSPENDED = 'SUSPENDED',
  DISABLED = 'DISABLED',
}

export type UserDocument = HydratedDocument<User>;

/**
 * User — an authenticatable account.
 *
 * Tenant-scoped via `organizationId` (null only for the platform SUPER_ADMIN).
 * Effective permissions are the union of the user's roles' permissions plus any
 * `directPermissions` grants; SUPER_ADMIN roles carry the `*` wildcard.
 *
 * Security fields support account lockout, password reset and (MFA-ready) 2FA.
 * The password hash is scrypt (see common/crypto/password.util) and is never
 * returned by the API (stripped in the response DTO / schema transform).
 */
@Schema({ ...baseSchemaOptions, collection: 'users' })
export class User {
  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null, index: true })
  organizationId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Department', default: null, index: true })
  departmentId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true, lowercase: true, unique: true, index: true })
  email!: string;

  /** scrypt hash — never exposed over the API. */
  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ type: [Types.ObjectId], ref: 'Role', default: [] })
  roleIds!: Types.ObjectId[];

  /** Ad-hoc permission grants beyond the user's roles. */
  @Prop({ type: [String], default: [] })
  directPermissions!: string[];

  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE, index: true })
  status!: UserStatus;

  // ── Security / lockout ─────────────────────────────────────────────────
  @Prop({ type: Number, default: 0 })
  failedLoginAttempts!: number;

  @Prop({ type: Date, default: null })
  lockedUntil?: Date | null;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ type: Boolean, default: false })
  mustChangePassword!: boolean;

  // ── MFA (ready, not enforced in Phase 1) ───────────────────────────────
  @Prop({ type: Boolean, default: false })
  mfaEnabled!: boolean;

  @Prop({ select: false })
  mfaSecret?: string;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
