import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class HotelOptionDto {
  @IsString() name!: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsNumber() stars?: number;
  @IsOptional() @IsString() roomType?: string;
  @IsOptional() @IsNumber() pricePerNight?: number;
  @IsOptional() @IsNumber() rooms?: number;
  @IsOptional() @IsNumber() nights?: number;
  /** Pre-calculated total per person (overrides auto-calc if provided) */
  @IsOptional() @IsNumber() pricePerPerson?: number;
}

export class ServiceItemDto {
  @IsString() name!: string;
  @IsOptional() @IsString() pricingType?: 'PRIVATE' | 'SHARED';
  @IsOptional() @IsNumber() capacity?: number;
  @IsOptional() @IsNumber() basePricePerUnit?: number;
  @IsOptional() @IsString() currency?: string;
  /** Pre-calculated per person (overrides auto-calc if provided) */
  @IsOptional() @IsNumber() pricePerPerson?: number;
}

export class GenerateQuoteDto {
  @IsString() customerName!: string;
  @IsOptional() @IsString() companyName?: string;
  @IsString() destination!: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsNumber() travelers!: number;
  @IsOptional() @IsNumber() adults?: number;
  @IsOptional() @IsNumber() children?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HotelOptionDto)
  hotels!: HotelOptionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceItemDto)
  services?: ServiceItemDto[];

  /** Markup percentage to add on top of costs (e.g. 15 = 15%) */
  @IsOptional() @IsNumber() markup?: number;
  /** Quote validity in hours (default 48) */
  @IsOptional() @IsNumber() validityHours?: number;
  /** Agent name shown in footer */
  @IsOptional() @IsString() agentName?: string;
  /** DMC brand name */
  @IsOptional() @IsString() brandName?: string;
  /** Currency (default AED) */
  @IsOptional() @IsString() currency?: string;
}

export interface QuoteHotelResult {
  name: string;
  stars?: number;
  location?: string;
  roomType?: string;
  nights: number;
  rooms: number;
  basePricePerPerson: number;
  servicesPricePerPerson: number;
  totalPricePerPerson: number;
  totalPrice: number;
  currency: string;
}

export interface GenerateQuoteResult {
  message: string;
  hotelPricing: QuoteHotelResult[];
  currency: string;
  validityHours: number;
}
