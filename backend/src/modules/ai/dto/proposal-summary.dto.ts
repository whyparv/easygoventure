import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

/**
 * Proposal details supplied inline so the AI module stays decoupled from the data layer.
 */
export class ProposalSummaryDto {
  @ApiProperty({ example: 'Dubai 4N/5D Package — 2 Adults' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ example: 'TRAVEL_PACKAGE' })
  @IsString()
  proposalType!: string;

  @ApiPropertyOptional({ example: 3500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Includes 4-star hotel, airport transfers, city tour and visa.' })
  @IsOptional()
  @IsString()
  description?: string;
}
