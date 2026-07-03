import { ApiProperty } from '@nestjs/swagger';

/**
 * Shared shape for all persisted entities exposed over the API.
 * Mirrors the `id / createdAt / updatedAt` fields present on every Mongoose document
 * (Mongo's `_id` is surfaced as `id`, with `timestamps: true` providing the dates).
 */
export abstract class BaseEntity {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
