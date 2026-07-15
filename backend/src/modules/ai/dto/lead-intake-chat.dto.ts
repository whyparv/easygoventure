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
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() hotels?: ExtractedHotelDto[];
  @IsOptional() @IsArray() services?: ExtractedServiceDto[];
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

export interface ExtractedHotel {
  city?: string;
  name?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  rating?: number;
  roomCount?: number;
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
    nationality?: string;
    notes?: string;
    hotels?: ExtractedHotel[];
    services?: ExtractedService[];
  };
  isComplete: boolean;
  missingFields: string[];
  whatsappGreeting?: string;
}
