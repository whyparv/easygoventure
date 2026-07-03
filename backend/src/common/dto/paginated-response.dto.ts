import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
  @ApiProperty() hasNext!: boolean;
  @ApiProperty() hasPrev!: boolean;
}

/**
 * Generic envelope for paginated list endpoints.
 */
export class PaginatedResponse<T> {
  @ApiProperty({ isArray: true })
  readonly data: T[];

  @ApiProperty({ type: PaginationMeta })
  readonly meta: PaginationMeta;

  constructor(data: T[], total: number, page: number, limit: number) {
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    this.data = data;
    this.meta = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
