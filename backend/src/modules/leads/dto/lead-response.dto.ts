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
