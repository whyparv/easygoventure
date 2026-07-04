import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Lead details supplied inline so the AI module stays decoupled from the data layer.
 */
export class FollowupSuggestionDto {
  @ApiProperty({ example: 'Acme Travels' })
  @IsString()
  @MinLength(1)
  leadName!: string;

  @ApiProperty({ example: 'VISA' })
  @IsString()
  inquiryType!: string;

  @ApiProperty({ example: 'QUOTE_SENT' })
  @IsString()
  status!: string;

  @ApiPropertyOptional({ example: 'Sent Dubai package proposal 3 days ago, no reply yet.' })
  @IsOptional()
  @IsString()
  context?: string;
}
