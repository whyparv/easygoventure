import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { FulfillmentStatus } from '../schemas/fulfillment.schema';

export class UpdateFulfillmentDto {
  @ApiPropertyOptional({ enum: FulfillmentStatus })
  @IsOptional()
  @IsEnum(FulfillmentStatus)
  status?: FulfillmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ example: '2026-07-10' })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}
