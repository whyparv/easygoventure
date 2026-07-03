import type { SchemaOptions } from 'mongoose';

/**
 * Shared Mongoose schema options applied to every collection.
 *
 * - `timestamps`  → adds `createdAt` / `updatedAt`
 * - `versionKey`  → drops the internal `__v`
 * - `toJSON`      → exposes `id` (string) and hides Mongo's `_id`
 *
 * Spread this into every `@Schema(...)` decorator so the API surface is consistent.
 */
export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};
