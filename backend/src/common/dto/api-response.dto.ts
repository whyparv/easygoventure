import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard success envelope returned by the global response interceptor.
 */
export class ApiResponse<T> {
  @ApiProperty({ default: true })
  readonly success: boolean = true;

  @ApiProperty()
  readonly data: T;

  @ApiProperty({ default: '' })
  readonly message: string;

  @ApiProperty({ format: 'date-time' })
  readonly timestamp: string;

  constructor(data: T, message = '') {
    this.data = data;
    this.message = message;
    this.timestamp = new Date().toISOString();
  }
}
