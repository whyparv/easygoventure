import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class GenerateQuotationDto {
  @ApiPropertyOptional({ format: 'date-time', description: 'Quotation validity (defaults to +14 days)' })
  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
