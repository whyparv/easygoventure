import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ServiceLineType, VendorRateStatus } from '../schemas/vendor-rate.schema';

export class CreateVendorRateDto {
  @ApiProperty({ description: 'Vendor this rate belongs to' })
  @IsMongoId()
  vendorId!: string;

  @ApiProperty({ enum: ServiceLineType, example: ServiceLineType.HOTEL })
  @IsEnum(ServiceLineType)
  rateType!: ServiceLineType;

  @ApiPropertyOptional({ description: 'Optional strong link to a catalog Service' })
  @IsOptional()
  @IsMongoId()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Optional strong link to a hotel (HOTEL rates)' })
  @IsOptional()
  @IsMongoId()
  hotelId?: string;

  @ApiPropertyOptional({ description: 'Loose link by service category/code', example: 'HOTEL' })
  @IsOptional()
  @IsString()
  serviceCode?: string;

  @ApiPropertyOptional({ default: 'USD', example: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiProperty({ example: 250, minimum: 0 })
  @IsNumber()
  @Min(0)
  netCost!: number;

  @ApiPropertyOptional({ example: 'per night' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minimumPax?: number;

  @ApiPropertyOptional({ example: 4, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maximumPax?: number;

  @ApiProperty({ format: 'date-time', example: '2026-07-01T00:00:00.000Z' })
  @IsDateString()
  validFrom!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional({ enum: VendorRateStatus, default: VendorRateStatus.ACTIVE })
  @IsOptional()
  @IsEnum(VendorRateStatus)
  status?: VendorRateStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
