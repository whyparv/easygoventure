import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'VISA', description: 'References an existing ServiceCategory code' })
  @IsString()
  categoryCode!: string;

  @ApiProperty({ example: 'Dubai 30-Day Tourist Visa' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'DXB-VISA-30D', description: 'Stable business code' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @ApiPropertyOptional({ example: 'Dubai', default: 'Dubai' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  destination?: string;

  @ApiPropertyOptional({ example: 'Tourist Visa', description: 'Sub-type within the category' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceType?: string;

  @ApiPropertyOptional({
    example: 'Airport Transfer',
    description: 'Groups variants under a generic requirement label',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  variantGroup?: string;

  @ApiPropertyOptional({ example: 'Single-entry tourist visa valid for 30 days.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'VFS Global', description: 'Preferred supplier/vendor' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplier?: string;

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

  @ApiPropertyOptional({ example: 350, minimum: 0, description: 'Legacy single price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ example: 300, minimum: 0, description: 'Net cost from supplier' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ example: 350, minimum: 0, description: 'Default price sold to agency' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultSellPrice?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
