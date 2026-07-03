import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProposalStatus, ProposalType } from '../schemas/proposal.schema';
import { FulfillmentResponseDto } from '../../fulfillments/dto/fulfillment-response.dto';

/** Documentation shape for a Proposal returned by the API. */
export class ProposalResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Owning organization (tenant)' })
  organizationId!: string;

  @ApiProperty()
  leadId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ProposalType })
  proposalType!: ProposalType;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: ProposalStatus })
  status!: ProposalStatus;

  @ApiProperty({ example: 'PRP-2026-83929' })
  generatedToken!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  expiresAt?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ default: false })
  isDeleted!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

/** Returned by POST /proposals/:id/accept */
export class AcceptProposalResponseDto {
  @ApiProperty({ type: ProposalResponseDto })
  proposal!: ProposalResponseDto;

  @ApiProperty({ type: FulfillmentResponseDto })
  fulfillment!: FulfillmentResponseDto;
}
