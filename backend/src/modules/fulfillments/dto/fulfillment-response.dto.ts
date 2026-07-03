import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FulfillmentStatus, FulfillmentType } from '../schemas/fulfillment.schema';

/** Documentation shape for a Fulfillment returned by the API. */
export class FulfillmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Owning organization (tenant)' })
  organizationId!: string;

  @ApiProperty()
  leadId!: string;

  @ApiPropertyOptional()
  proposalId?: string;

  @ApiProperty({ enum: FulfillmentType })
  type!: FulfillmentType;

  @ApiProperty({ enum: FulfillmentStatus })
  status!: FulfillmentStatus;

  @ApiPropertyOptional()
  remarks?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  dueDate?: string;

  @ApiProperty({ default: false })
  isDeleted!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
