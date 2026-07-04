import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { InquiryType, LeadSource, LeadStatus } from '../schemas/lead.schema';
import {
  sanitizeEmail,
  sanitizeName,
  sanitizePhone,
} from '../../../common/utils/sanitize.util';

/** One hotel option quoted to the agency. */
export class LeadHotelOptionDto {
  @ApiProperty({ example: 'Al Khoory Sky Garden' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 4, minimum: 0, maximum: 7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(7)
  starRating?: number;

  @ApiPropertyOptional({ example: 'Al Qusais, Dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ example: 'Classic Room' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  roomType?: string;

  @ApiPropertyOptional({ example: 365, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerPerson?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  recommended?: boolean;
}

/** A catalog service attached to a lead — a point-in-time snapshot. */
export class LeadServiceItemDto {
  @ApiPropertyOptional({ description: 'Catalog Service id (null for a custom service)' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiProperty({ example: '96hr UAE Visa' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  serviceName!: string;

  @ApiPropertyOptional({ example: 'VISA' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  categoryCode?: string;

  @ApiPropertyOptional({ example: 'Airport Transfer', description: 'Requirement group fulfilled' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  variantGroup?: string;

  @ApiPropertyOptional({ example: 'VFS Global' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplier?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 80, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ example: 110, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellPrice?: number;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  snapshotDate?: Date;
}

export class CreateLeadDto {
  // A travel-agency inquiry rarely arrives complete. Nothing here is mandatory —
  // the lead is captured with whatever partial info is available and enriched later.
  @ApiPropertyOptional({ example: 'Acme Travels' })
  @Transform(({ value }) => sanitizeName(value as string))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '+971500000000' })
  @Transform(({ value }) => sanitizePhone(value as string))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

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

  @ApiPropertyOptional({ enum: InquiryType, default: InquiryType.TRAVEL_PACKAGE })
  @IsOptional()
  @IsEnum(InquiryType)
  inquiryType?: InquiryType;

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

  // ── Inquiry requirements (the working brief) ───────────────────────────────
  @ApiPropertyOptional({
    description: 'AI-interpreted CLIENT REQUIREMENTS brief preserving original intent',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  requirementsNote?: string;

  @ApiPropertyOptional({
    description: 'Services the client requested (drives suggestions)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  requestedServices?: string[];

  @ApiPropertyOptional({
    description: 'Hotels the client named in the inquiry (drives suggestions)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  requestedHotels?: string[];

  // ── Travel information ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'Dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  destination?: string;

  @ApiPropertyOptional({ example: '2026-06-15', format: 'date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  travelDate?: Date;

  @ApiPropertyOptional({ example: '2026-06-19', format: 'date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  returnDate?: Date;

  @ApiPropertyOptional({ example: 2, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  adults?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  rooms?: number;

  @ApiPropertyOptional({ example: 4, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  nights?: number;

  @ApiPropertyOptional({
    description: 'Selected services (free-form labels)',
    example: ['Visa', 'Airport Transfer', 'Desert Safari'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  services?: string[];

  @ApiPropertyOptional({ type: [LeadServiceItemDto], description: 'Catalog service snapshots' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LeadServiceItemDto)
  serviceItems?: LeadServiceItemDto[];

  // ── Hotel options & pricing ────────────────────────────────────────────────
  @ApiPropertyOptional({ type: [LeadHotelOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LeadHotelOptionDto)
  hotelOptions?: LeadHotelOptionDto[];

  @ApiPropertyOptional({ example: 100, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  markup?: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 48, minimum: 0, description: 'Quote validity in hours' })
  @IsOptional()
  @IsInt()
  @Min(0)
  quoteValidityHours?: number;

  // ── Internal tracking ──────────────────────────────────────────────────────
  @ApiPropertyOptional({
    description: 'EasyGo Venture staff who prepared the quote / handled the lead',
    example: 'Aisha',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  preparedBy?: string;
}
