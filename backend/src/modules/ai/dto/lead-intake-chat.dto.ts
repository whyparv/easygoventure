import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ChatTurnDto } from './chat.dto';

export class ExtractedHotelDto {
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() checkIn?: string;
  @IsOptional() @IsString() checkOut?: string;
  @IsOptional() @IsNumber() nights?: number;
  @IsOptional() @IsNumber() rating?: number;
  @IsOptional() @IsNumber() roomCount?: number;
  @IsOptional() @IsString() roomType?: string;
  @IsOptional() @IsNumber() maxOccupancy?: number;
  /** SINGLE | DOUBLE | TRIPLE — occupancy per room */
  @IsOptional() @IsString() occupancyType?: string;
  /** Pax in this room segment (for mixed configs). Omit when all pax share same room type. */
  @IsOptional() @IsNumber() paxCount?: number;
  @IsOptional() @IsNumber() pricePerNight?: number;
}

export class ExtractedServiceDto {
  @IsOptional() @IsString() name?: string;
  /** transfer | tour | activity | visa | meal | other */
  @IsOptional() @IsString() serviceType?: string;
  /** PRIVATE = each person/booking pays full price; SHARED = cost split by pax */
  @IsOptional() @IsString() pricingType?: string;
  /** For SHARED: how many people fit in one unit (e.g. 4 for sedan, 7 for van) */
  @IsOptional() @IsNumber() capacity?: number;
  /** Full cost of one unit (one cab, one visa, one ticket) */
  @IsOptional() @IsNumber() basePricePerUnit?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() notes?: string;
}

/** Partial lead fields gathered so far in the conversation. */
export class ExtractedDestinationDto {
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() checkIn?: string;
  @IsOptional() @IsString() checkOut?: string;
  @IsOptional() @IsNumber() nights?: number;
  @IsOptional() @IsNumber() order?: number;
}

export class ExtractedLeadDataDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() inquiryType?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsNumber() budget?: number;
  @IsOptional() @IsNumber() travelers?: number;
  @IsOptional() @IsNumber() adults?: number;
  @IsOptional() @IsNumber() children?: number;
  @IsOptional() @IsNumber() infants?: number;
  @IsOptional() @IsArray() childAges?: number[];
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() destinations?: ExtractedDestinationDto[];
  @IsOptional() @IsArray() hotels?: ExtractedHotelDto[];
  @IsOptional() @IsArray() services?: ExtractedServiceDto[];
  /** Margin/markup percentage to apply over cost. Ask AI: "What margin % to add?" */
  @IsOptional() @IsNumber() markup?: number;
}

export class LeadIntakeChatDto {
  @ApiProperty({ description: 'The user message in the intake chat' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({ type: [ChatTurnDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];

  @ApiPropertyOptional({ description: 'Lead fields extracted so far' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ExtractedLeadDataDto)
  extractedData?: ExtractedLeadDataDto;
}

export interface ExtractedDestination {
  city: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  order: number;
}

export interface ExtractedHotel {
  city?: string;
  name?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  rating?: number;
  roomCount?: number;
  roomType?: string;
  maxOccupancy?: number;
  occupancyType?: 'SINGLE' | 'DOUBLE' | 'TRIPLE';
  paxCount?: number;
  pricePerNight?: number;
}

export interface ExtractedService {
  name?: string;
  serviceType?: string;
  pricingType?: 'PRIVATE' | 'SHARED';
  capacity?: number;
  basePricePerUnit?: number;
  currency?: string;
  date?: string;
  notes?: string;
}

export interface LeadIntakeChatResponse {
  reply: string;
  extractedData: {
    name?: string;
    phone?: string;
    email?: string;
    companyName?: string;
    inquiryType?: string;
    source?: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    budget?: number;
    travelers?: number;
    adults?: number;
    children?: number;
    infants?: number;
    childAges?: number[];
    nationality?: string;
    notes?: string;
    destinations?: ExtractedDestination[];
    hotels?: ExtractedHotel[];
    services?: ExtractedService[];
    markup?: number;
  };
  isComplete: boolean;
  missingFields: string[];
  whatsappGreeting?: string;
}
