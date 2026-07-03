import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export type DepartmentDocument = HydratedDocument<Department>;

/**
 * Department — an organizational unit within a tenant (Sales, Operations, Visa…).
 * Users belong to a department; department scope can further narrow permissions.
 */
@Schema({ ...baseSchemaOptions, collection: 'departments' })
export class Department {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);

// One department name per organization.
DepartmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });
