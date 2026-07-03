import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { FulfillmentStatus, FulfillmentType } from '../schemas/fulfillment.schema';

export class CreateFulfillmentDto {
  @ApiProperty({ description: 'Lead this fulfillment belongs to' })
  @IsMongoId()
  leadId!: string;

  @ApiPropertyOptional({ description: 'Originating proposal, if any' })
  @IsOptional()
  @IsMongoId()
  proposalId?: string;

  @ApiProperty({ enum: FulfillmentType, example: FulfillmentType.VISA })
  @IsEnum(FulfillmentType)
  type!: FulfillmentType;

  @ApiPropertyOptional({ enum: FulfillmentStatus, default: FulfillmentStatus.PENDING })
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
