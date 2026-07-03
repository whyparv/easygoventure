import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RecommendHotelsDto {
  @ApiPropertyOptional({ example: 'Dubai' })
  @IsString()
  @IsOptional()
  destination?: string;

  @ApiPropertyOptional({ example: 15000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  budget?: number;

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
}
