import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseEntity } from '../../../common/entities/base.entity';
import { FulfillmentItemStatus, ServiceLineType } from '../schemas/fulfillment-item.schema';
import { ProposalBookingStatus } from '../schemas/proposal.schema';

export class UpdateFulfillmentItemDto {
  @ApiPropertyOptional({ enum: FulfillmentItemStatus })
  @IsEnum(FulfillmentItemStatus)
  @IsOptional()
  status?: FulfillmentItemStatus;

  @ApiPropertyOptional({ description: 'Vendor booking confirmation reference' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  confirmationRef?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

export class FulfillmentItemResponseDto extends BaseEntity {
  @ApiProperty() organizationId!: string;
  @ApiProperty() proposalId!: string;
  @ApiPropertyOptional() packageItemId?: string;
  @ApiProperty({ enum: ServiceLineType }) type!: ServiceLineType;
  @ApiProperty() description!: string;
  @ApiProperty() quantity!: number;
  @ApiPropertyOptional() vendorRateId?: string;
  @ApiPropertyOptional() vendorName?: string;
  @ApiProperty({ enum: FulfillmentItemStatus }) status!: FulfillmentItemStatus;
  @ApiPropertyOptional() confirmationRef?: string;
  @ApiPropertyOptional() notes?: string;
}

export class ProposalLineageResponseDto {
  @ApiPropertyOptional({ nullable: true }) leadId!: string | null;
  @ApiPropertyOptional({ nullable: true }) inquiryId!: string | null;
  @ApiPropertyOptional({ nullable: true }) packageId!: string | null;
  @ApiPropertyOptional({ nullable: true }) quotationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) quotationNumber!: string | null;
  @ApiPropertyOptional({ nullable: true }) quotationVersion!: number | null;
  @ApiProperty() proposalId!: string;
}

export class ReadinessResponseDto {
  @ApiProperty() ready!: boolean;
  @ApiProperty({ type: [String] }) issues!: string[];
  @ApiProperty({ type: Object }) checks!: Record<string, unknown>;
}

export class BookingStatusResponseDto {
  @ApiProperty({ enum: ProposalBookingStatus }) bookingStatus!: ProposalBookingStatus;
}
