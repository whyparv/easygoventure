import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { LeadActivityType } from '../schemas/lead-activity.schema';

export class CreateLeadActivityDto {
  @ApiProperty({ enum: LeadActivityType, example: LeadActivityType.NOTE_ADDED })
  @IsEnum(LeadActivityType)
  type!: LeadActivityType;

  @ApiProperty({ example: 'Called the agency, awaiting documents.' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
