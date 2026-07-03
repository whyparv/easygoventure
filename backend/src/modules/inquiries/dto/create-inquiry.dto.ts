import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { InquirySource } from '../schemas/inquiry.schema';
import {
  sanitizeDestination,
  sanitizeEmail,
  sanitizeName,
  sanitizePhone,
} from '../../../common/utils/sanitize.util';

export class CreateInquiryDto {
  @ApiProperty({ example: 'Acme Travels' })
  @Transform(({ value }) => sanitizeName(value as string))
  @IsString()
  @MinLength(2)
  customerName!: string;

  @ApiPropertyOptional({ enum: InquirySource, default: InquirySource.MANUAL })
  @IsEnum(InquirySource)
  @IsOptional()
  source?: InquirySource;

  @ApiPropertyOptional({ example: '+971500000000' })
  @Transform(({ value }) => sanitizePhone(value as string))
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => sanitizeEmail(value as string))
  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => sanitizeName(value as string))
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({ example: 'Dubai' })
  @Transform(({ value }) => sanitizeDestination(value as string))
  @IsString()
  @IsOptional()
  destination?: string;

  @ApiPropertyOptional({ example: 'VISA', description: 'ServiceCategory code' })
  @IsString()
  @IsOptional()
  serviceCategoryCode?: string;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  travelers?: number;

  @ApiPropertyOptional({ example: '2026-07-15' })
  @IsDateString()
  @IsOptional()
  travelDate?: string;

  @ApiPropertyOptional({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  budget?: number;

  @ApiPropertyOptional({ description: 'Raw inbound message' })
  @IsString()
  @IsOptional()
  rawInquiry?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Assign to a user id' })
  @IsMongoId()
  @IsOptional()
  assignedToUserId?: string;
}
