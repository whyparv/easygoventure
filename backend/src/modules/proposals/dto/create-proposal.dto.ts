import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  MinLength,
} from 'class-validator';
import { ProposalType } from '../schemas/proposal.schema';

export class CreateProposalDto {
  @ApiProperty({ description: 'Lead this proposal belongs to' })
  @IsMongoId()
  leadId!: string;

  @ApiProperty({ example: 'Dubai 4N/5D Package — 2 Adults' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ProposalType, example: ProposalType.TRAVEL_PACKAGE })
  @IsEnum(ProposalType)
  proposalType!: ProposalType;

  @ApiPropertyOptional({ default: 0, example: 3500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ default: 'USD', example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'ISO date the proposal expires', example: '2026-07-01' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
