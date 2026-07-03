import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePackageDto {
  @ApiProperty({ example: 'Dubai 5-day honeymoon' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ description: 'Inquiry this package prices' })
  @IsMongoId()
  @IsOptional()
  inquiryId?: string;

  @ApiPropertyOptional({ example: 'Dubai' })
  @IsString()
  @IsOptional()
  destination?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  travelStartDate?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  travelEndDate?: string;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 100, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  numberOfTravelers?: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsString()
  @Length(3, 3)
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
