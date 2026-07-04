import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Documentation shape for a Service returned by the API. */
export class ServiceResponseDto extends BaseEntity {
  @ApiProperty({ description: 'Owning organization id' })
  organizationId!: string;

  @ApiProperty({ description: 'References a ServiceCategory code', example: 'VISA' })
  categoryCode!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ example: 'DXB-VISA-30D' })
  code?: string;

  @ApiProperty({ example: 'Dubai' })
  destination!: string;

  @ApiPropertyOptional({ example: 'Tourist Visa' })
  serviceType?: string;

  @ApiPropertyOptional({ example: 'Airport Transfer', description: 'Variant group label' })
  variantGroup?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'VFS Global' })
  supplier?: string;

  @ApiProperty({ type: [String] })
  requiredFields!: string[];

  @ApiProperty({ type: [String] })
  requiredDocuments!: string[];

  @ApiPropertyOptional()
  defaultTerms?: string;

  @ApiPropertyOptional({ example: '5 Days' })
  processingTime?: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiPropertyOptional({ example: 350 })
  basePrice?: number;

  @ApiPropertyOptional({ example: 300 })
  costPrice?: number;

  @ApiPropertyOptional({ example: 350 })
  defaultSellPrice?: number;

  @ApiProperty({ default: true })
  isActive!: boolean;
}

/** Returned by DELETE /services/:id */
export class DeletedResponseDto {
  @ApiProperty()
  id!: string;
}

/** Documentation shape for a global ServiceCategory returned by the API. */
export class ServiceCategoryResponseDto extends BaseEntity {
  @ApiProperty({ example: 'VISA' })
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  icon?: string;

  @ApiProperty({ default: 0 })
  sortOrder!: number;

  @ApiProperty({ default: true })
  isActive!: boolean;
}
