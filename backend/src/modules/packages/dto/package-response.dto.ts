import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ServiceLineType } from '../../../common/enums/service-line.enum';
import { PackageStatus } from '../schemas/package.schema';
import { MarkupType } from '../schemas/package-item.schema';

export class PackageResponseDto extends BaseEntity {
  @ApiProperty() organizationId!: string;
  @ApiPropertyOptional({ nullable: true }) inquiryId?: string | null;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() destination?: string;
  @ApiPropertyOptional() travelStartDate?: Date;
  @ApiPropertyOptional() travelEndDate?: Date;
  @ApiProperty() numberOfTravelers!: number;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: PackageStatus }) status!: PackageStatus;
  @ApiProperty() totalCost!: number;
  @ApiProperty() totalMarkup!: number;
  @ApiProperty() totalSellPrice!: number;
  @ApiProperty() expectedProfit!: number;
  @ApiPropertyOptional() notes?: string;
}

export class PackageItemResponseDto extends BaseEntity {
  @ApiProperty() organizationId!: string;
  @ApiProperty() packageId!: string;
  @ApiProperty({ enum: ServiceLineType }) type!: ServiceLineType;
  @ApiPropertyOptional({ nullable: true }) referenceId?: string | null;
  @ApiPropertyOptional({ nullable: true }) vendorRateId?: string | null;
  @ApiProperty() description!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitCost!: number;
  @ApiProperty({ enum: MarkupType }) markupType!: MarkupType;
  @ApiProperty() markupValue!: number;
  @ApiProperty() unitSellPrice!: number;
  @ApiProperty() totalCost!: number;
  @ApiProperty() totalSellPrice!: number;
  @ApiProperty() profit!: number;
}

export class DeletedResponseDto {
  @ApiProperty() id!: string;
}
