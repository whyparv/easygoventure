import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { InquiryType, LeadSource, LeadStatus, TravelerType, FlightType, FlightClass } from '../schemas/lead.schema';
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

  @ApiPropertyOptional({ example: 'AED', default: 'AED' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 450, minimum: 0, description: 'AED sell rate per room per night' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerNight?: number;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  roomCount?: number;

  @ApiPropertyOptional({ example: 3, minimum: 1, description: 'Max guests allowed per room' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccupancy?: number;

  @ApiPropertyOptional({ example: 4, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  nights?: number;

  @ApiPropertyOptional({ example: 3600, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPrice?: number;

  @ApiPropertyOptional({ example: 365, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerPerson?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  recommended?: boolean;

  @ApiPropertyOptional({ enum: ['SINGLE', 'DOUBLE', 'TRIPLE'], description: 'How many pax share one room' })
  @IsOptional()
  @IsIn(['SINGLE', 'DOUBLE', 'TRIPLE'])
  occupancyType?: 'SINGLE' | 'DOUBLE' | 'TRIPLE';

  @ApiPropertyOptional({ example: 3, minimum: 1, description: 'Pax in this room segment (for mixed configs)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  paxCount?: number;
}

export class LeadHotelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hotelId?: string;

  @ApiProperty({ example: 'Atlantis The Palm' })
  @IsString()
  @MinLength(1)
  hotelName!: string;

  @ApiPropertyOptional({ example: 'Deluxe Ocean View' })
  @IsOptional()
  @IsString()
  roomType?: string;

  @ApiPropertyOptional({ example: 'Breakfast Included' })
  @IsOptional()
  @IsString()
  mealPlan?: string;

  @ApiPropertyOptional({ example: '2025-12-15' })
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @ApiPropertyOptional({ example: '2025-12-18' })
  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  nights?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  roomCount?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  rating?: number;

  @ApiPropertyOptional({ example: 350 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerNight?: number;

  @ApiPropertyOptional({ example: 1050 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPrice?: number;

  @ApiPropertyOptional({ example: 'AED' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class LeadLocationDto {
  @ApiProperty({ description: 'Client-generated UUID to key this location' })
  @IsString()
  locationId!: string;

  @ApiProperty({ example: 'Dubai' })
  @IsString()
  @MinLength(1)
  city!: string;

  @ApiPropertyOptional({ example: 'UAE' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  nights?: number;

  @ApiPropertyOptional({ example: '2025-12-15' })
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @ApiPropertyOptional({ example: '2025-12-19' })
  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @ApiPropertyOptional({ type: [LeadHotelDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadHotelDto)
  hotels?: LeadHotelDto[];
}

export class LeadFlightDto {
  @ApiProperty({ description: 'Client-generated UUID' })
  @IsString()
  flightId!: string;

  @ApiPropertyOptional({ enum: FlightType, default: FlightType.OUTBOUND })
  @IsOptional()
  @IsEnum(FlightType)
  type?: FlightType;

  @ApiPropertyOptional({ example: 'Emirates' })
  @IsOptional()
  @IsString()
  airline?: string;

  @ApiPropertyOptional({ example: 'EK203' })
  @IsOptional()
  @IsString()
  flightNo?: string;

  @ApiPropertyOptional({ example: 'LHR' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: 'DXB' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ example: '2025-12-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '08:30' })
  @IsOptional()
  @IsString()
  departureTime?: string;

  @ApiPropertyOptional({ example: '2025-12-15' })
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @ApiPropertyOptional({ example: '19:45' })
  @IsOptional()
  @IsString()
  arrivalTime?: string;

  @ApiPropertyOptional({ enum: FlightClass, default: FlightClass.ECONOMY })
  @IsOptional()
  @IsEnum(FlightClass)
  flightClass?: FlightClass;

  @ApiPropertyOptional({ example: 750 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerPerson?: number;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPrice?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class LeadTravelerDto {
  @ApiProperty({ description: 'Client-generated UUID' })
  @IsString()
  travelerId!: string;

  @ApiPropertyOptional({ enum: TravelerType, default: TravelerType.ADULT })
  @IsOptional()
  @IsEnum(TravelerType)
  type?: TravelerType;

  @ApiPropertyOptional({ example: 'Ahmed' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Khan' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Indian' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ example: 'A1234567' })
  @IsOptional()
  @IsString()
  passportNo?: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
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

  @ApiPropertyOptional({ example: 'AED' })
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

  @ApiPropertyOptional({ example: 200, minimum: 0, description: 'Base price per booking unit (used with pricingType to compute sellPrice)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePricePerUnit?: number;

  @ApiPropertyOptional({ enum: ['PRIVATE', 'SHARED'], default: 'PRIVATE' })
  @IsOptional()
  @IsIn(['PRIVATE', 'SHARED'])
  pricingType?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1, description: 'Max pax per unit for SHARED services' })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

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

  @ApiPropertyOptional({ example: '2025-12-15', description: 'Overall trip start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-12-22', description: 'Overall trip end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Original inbound message the lead was created from' })
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

  @ApiPropertyOptional({ example: 'AED', default: 'AED' })
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

  @ApiPropertyOptional({ description: 'Saved WhatsApp quote text' })
  @IsOptional()
  @IsString()
  whatsappMessage?: string;

  @ApiPropertyOptional({ type: [LeadLocationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadLocationDto)
  locations?: LeadLocationDto[];

  @ApiPropertyOptional({ type: [LeadFlightDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadFlightDto)
  flights?: LeadFlightDto[];

  @ApiPropertyOptional({ type: [LeadTravelerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeadTravelerDto)
  travelers?: LeadTravelerDto[];
}
