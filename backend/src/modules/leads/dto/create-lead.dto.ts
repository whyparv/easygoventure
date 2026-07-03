import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { InquiryType, LeadSource, LeadStatus } from '../schemas/lead.schema';
import {
  sanitizeEmail,
  sanitizeName,
  sanitizePhone,
} from '../../../common/utils/sanitize.util';

export class CreateLeadDto {
  @ApiProperty({ example: 'Acme Travels' })
  @Transform(({ value }) => sanitizeName(value as string))
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: '+971500000000' })
  @Transform(({ value }) => sanitizePhone(value as string))
  @IsString()
  @MinLength(5)
  phone!: string;

  @ApiPropertyOptional({ example: 'sales@acme.com' })
  @Transform(({ value }) => sanitizeEmail(value as string))
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Acme Travels LLC' })
  @Transform(({ value }) => sanitizeName(value as string))
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ enum: LeadSource, default: LeadSource.WHATSAPP })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiProperty({ enum: InquiryType, example: InquiryType.VISA })
  @IsEnum(InquiryType)
  inquiryType!: InquiryType;

  @ApiPropertyOptional({ enum: LeadStatus, default: LeadStatus.NEW })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Original inbound message the lead was created from',
    example: 'Hi, I need Dubai visa for 2 adults travelling on 15th July.',
  })
  @IsOptional()
  @IsString()
  rawInquiry?: string;
}
