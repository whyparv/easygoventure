import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/**
 * AuditLog — an append-only record of every consequential write in the platform.
 *
 * This generalizes the per-lead activity-timeline pattern to a tenant-wide,
 * immutable trail. Records are never updated or deleted (no soft-delete fields).
 */
@Schema({ ...baseSchemaOptions, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'Organization', default: null, index: true })
  organizationId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  userId!: Types.ObjectId | null;

  @Prop({ trim: true })
  userEmail?: string;

  /** Domain action, e.g. "user.login", "role.assign", "ai.action.executed". */
  @Prop({ required: true, trim: true, index: true })
  action!: string;

  /** Target entity type, e.g. "User", "Vendor", "Proposal". */
  @Prop({ required: true, trim: true, index: true })
  entity!: string;

  @Prop({ trim: true, index: true })
  entityId?: string;

  @Prop({ type: Object })
  oldValue?: Record<string, unknown>;

  @Prop({ type: Object })
  newValue?: Record<string, unknown>;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ trim: true })
  ip?: string;

  @Prop({ trim: true })
  userAgent?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ organizationId: 1, entity: 1, createdAt: -1 });
AuditLogSchema.index({ organizationId: 1, action: 1, createdAt: -1 });
