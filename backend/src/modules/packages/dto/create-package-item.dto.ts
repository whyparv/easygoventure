import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ServiceLineType } from '../../../common/enums/service-line.enum';
import { MarkupType } from '../schemas/package-item.schema';

export class CreatePackageItemDto {
  @ApiProperty({ enum: ServiceLineType })
  @IsEnum(ServiceLineType)
  type!: ServiceLineType;

  @ApiPropertyOptional({ description: 'Loose reference to the underlying entity (hotel/service)' })
  @IsMongoId()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Vendor rate to source the cost from' })
  @IsMongoId()
  @IsOptional()
  vendorRateId?: string;

  @ApiProperty({ example: '2 nights, Deluxe Room' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({
    example: 250,
    minimum: 0,
    description: 'Supplier net cost per unit. Optional if vendorRateId is given (pulled from the rate).',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitCost?: number;

  @ApiPropertyOptional({ enum: MarkupType, default: MarkupType.PERCENTAGE })
  @IsEnum(MarkupType)
  @IsOptional()
  markupType?: MarkupType;

  @ApiPropertyOptional({ example: 20, minimum: 0, description: 'Percent (e.g. 20) or fixed amount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  markupValue?: number;
}
