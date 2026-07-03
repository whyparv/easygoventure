import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';
import { PermissionScope } from '../../auth/rbac/permissions';

export type RoleDocument = HydratedDocument<Role>;

/**
 * Role — a named bundle of permission keys.
 *
 * - System roles (`isSystem: true`, `organizationId: null`) are seeded templates
 *   shared across tenants and cannot be deleted.
 * - Organizations may create their own roles (`organizationId` set) or clone
 *   system templates to customize permissions.
 */
@Schema({ ...baseSchemaOptions, collection: 'roles' })
export class Role {
  /** Null for system-role templates; set for organization-specific roles. */
  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null, index: true })
  organizationId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true, uppercase: true, index: true })
  code!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  description?: string;

  /** Permission keys, or `['*']` for the platform super-admin role. */
  @Prop({ type: [String], default: [] })
  permissions!: string[];

  @Prop({ type: String, enum: PermissionScope, default: PermissionScope.ORGANIZATION })
  scope!: PermissionScope;

  @Prop({ type: Boolean, default: false, index: true })
  isSystem!: boolean;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const RoleSchema = SchemaFactory.createForClass(Role);

// A role code is unique within an organization (and among global templates where
// organizationId is null).
RoleSchema.index({ organizationId: 1, code: 1 }, { unique: true });
