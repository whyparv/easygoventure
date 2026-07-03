import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ServiceLineType, VendorRateStatus } from '../schemas/vendor-rate.schema';

/** Documentation shape for a VendorRate returned by the API. */
export class VendorRateResponseDto extends BaseEntity {
  @ApiProperty({ description: 'Owning organization id' })
  organizationId!: string;

  @ApiProperty({ description: 'Vendor this rate belongs to' })
  vendorId!: string;

  @ApiProperty({ enum: ServiceLineType })
  rateType!: ServiceLineType;

  @ApiPropertyOptional({ description: 'Optional strong link to a catalog Service' })
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Optional strong link to a hotel' })
  hotelId?: string;

  @ApiPropertyOptional({ description: 'Alternative loose link by service category/code' })
  serviceCode?: string;

  @ApiProperty({ default: 'USD' })
  currency!: string;

  @ApiProperty({ example: 250 })
  netCost!: number;

  @ApiPropertyOptional({ example: 'per night' })
  unit?: string;

  @ApiPropertyOptional({ example: 1 })
  minimumPax?: number;

  @ApiPropertyOptional({ example: 4 })
  maximumPax?: number;

  @ApiProperty({ format: 'date-time' })
  validFrom!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  validTo?: string;

  @ApiProperty({ enum: VendorRateStatus })
  status!: VendorRateStatus;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ default: true })
  isActive!: boolean;

  @ApiProperty({ default: false })
  isDeleted!: boolean;
}
