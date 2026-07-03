import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export type ServiceCategoryDocument = HydratedDocument<ServiceCategory>;

/**
 * Global reference data — a service category (e.g. VISA, HOTEL, TRANSFER) shared
 * across every organization. Not tenant-scoped and not soft-deletable.
 */
@Schema({ ...baseSchemaOptions, collection: 'service_categories' })
export class ServiceCategory {
  @Prop({ required: true, trim: true, uppercase: true, unique: true, index: true })
  code!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  icon?: string;

  @Prop({ type: Number, default: 0 })
  sortOrder!: number;

  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;
}

export const ServiceCategorySchema = SchemaFactory.createForClass(ServiceCategory);
