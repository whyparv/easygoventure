import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class ProposalDraftDto {
  @ApiProperty({ example: 'Dubai' })
  @IsString()
  @MinLength(2)
  destination!: string;

  @ApiPropertyOptional({ example: 'Aisha Khan' })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  travelers?: number;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 60 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  nights?: number;

  @ApiPropertyOptional({ example: 15000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  budget?: number;

  @ApiPropertyOptional({ format: 'date', example: '2026-12-01' })
  @IsString()
  @IsOptional()
  travelDate?: string;
}
