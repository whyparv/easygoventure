import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InquiryType, LeadSource, LeadStatus } from '../schemas/lead.schema';
import { LeadActivityType } from '../schemas/lead-activity.schema';

/** Documentation shape for a Lead returned by the API. */
export class LeadResponseDto {
  @ApiProperty({ description: 'Mongo document id' })
  id!: string;

  @ApiProperty({ description: 'Owning organization (tenant)' })
  organizationId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  phone!: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  companyName?: string;

  @ApiProperty({ enum: LeadSource })
  source!: LeadSource;

  @ApiProperty({ enum: InquiryType })
  inquiryType!: InquiryType;

  @ApiProperty({ enum: LeadStatus })
  status!: LeadStatus;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  rawInquiry?: string;

  @ApiPropertyOptional()
  requirementsNote?: string;

  @ApiPropertyOptional({ type: [String] })
  requestedServices?: string[];

  @ApiPropertyOptional({ type: [String] })
  requestedHotels?: string[];

  @ApiPropertyOptional()
  destination?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  travelDate?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  returnDate?: string;

  @ApiPropertyOptional()
  adults?: number;

  @ApiPropertyOptional()
  children?: number;

  @ApiPropertyOptional()
  rooms?: number;

  @ApiPropertyOptional()
  nights?: number;

  @ApiPropertyOptional({ type: [String] })
  services?: string[];

  @ApiPropertyOptional({ type: Object, isArray: true })
  serviceItems?: Record<string, unknown>[];

  @ApiPropertyOptional({ type: Object, isArray: true })
  hotelOptions?: Record<string, unknown>[];

  @ApiPropertyOptional()
  markup?: number;

  @ApiPropertyOptional()
  currency?: string;

  @ApiPropertyOptional()
  quoteValidityHours?: number;

  @ApiPropertyOptional()
  preparedBy?: string;

  @ApiProperty({ default: false })
  isDeleted!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** Documentation shape for a lead timeline activity. */
export class LeadActivityResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Owning organization (tenant)' })
  organizationId!: string;

  @ApiProperty()
  leadId!: string;

  @ApiProperty({ enum: LeadActivityType })
  type!: LeadActivityType;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown>;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** Returned by DELETE /leads/:id */
export class DeletedResponseDto {
  @ApiProperty()
  id!: string;
}
