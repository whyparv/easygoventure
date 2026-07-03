import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';
import { PermissionScope } from '../../auth/rbac/permissions';

export type PermissionDocument = HydratedDocument<Permission>;

/**
 * Permission — a single unit of authority (`resource.action`). This is a GLOBAL
 * catalog (seeded from PERMISSION_CATALOG); roles reference these keys. Storing
 * the catalog makes permissions discoverable via API and lets the UI render a
 * permission matrix without hardcoding.
 */
@Schema({ ...baseSchemaOptions, collection: 'permissions' })
export class Permission {
  @Prop({ required: true, trim: true, unique: true, index: true })
  key!: string;

  @Prop({ required: true, trim: true, index: true })
  group!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ type: String, enum: PermissionScope, default: PermissionScope.ORGANIZATION })
  defaultScope!: PermissionScope;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
