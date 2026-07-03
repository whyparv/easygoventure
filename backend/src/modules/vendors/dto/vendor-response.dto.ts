import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Documentation shape for a Vendor returned by the API. */
export class VendorResponseDto extends BaseEntity {
  @ApiProperty({ description: 'Owning organization id' })
  organizationId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  contactPerson?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiProperty({ type: [String], default: [] })
  supportedServices!: string[];

  @ApiPropertyOptional()
  paymentTerms?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ default: true })
  isActive!: boolean;

  @ApiProperty({ default: false })
  isDeleted!: boolean;
}

/** Returned by DELETE /vendors/:id */
export class DeletedResponseDto {
  @ApiProperty()
  id!: string;
}
