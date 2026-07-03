import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard error envelope returned by the global exception filter.
 */
export class ApiError {
  @ApiProperty({ default: false })
  readonly success: boolean = false;

  @ApiProperty()
  readonly statusCode: number;

  @ApiProperty()
  readonly code: string;

  @ApiProperty()
  readonly message: string;

  @ApiProperty({ required: false, type: [String] })
  readonly details?: string[];

  @ApiProperty()
  readonly path: string;

  @ApiProperty()
  readonly timestamp: string;

  constructor(params: {
    statusCode: number;
    code: string;
    message: string;
    path: string;
    details?: string[];
  }) {
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.message = params.message;
    this.details = params.details;
    this.path = params.path;
    this.timestamp = new Date().toISOString();
  }
}
