import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'VISA', description: 'References an existing ServiceCategory code' })
  @IsString()
  categoryCode!: string;

  @ApiProperty({ example: 'Dubai 30-Day Tourist Visa' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Single-entry tourist visa valid for 30 days.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], example: ['passportNumber', 'travelDate'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredFields?: string[] = [];

  @ApiPropertyOptional({ type: [String], example: ['passportCopy', 'photo'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredDocuments?: string[] = [];

  @ApiPropertyOptional({ example: '50% advance, balance on approval.' })
  @IsOptional()
  @IsString()
  defaultTerms?: string;

  @ApiPropertyOptional({ example: '5 Days' })
  @IsOptional()
  @IsString()
  processingTime?: string;

  @ApiPropertyOptional({ example: 'USD', minLength: 3, maxLength: 3 })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 350, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
