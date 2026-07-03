import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

export class OrganizationResponseDto extends BaseEntity {
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional() logo?: string;
  @ApiProperty() timezone!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() subscriptionPlan!: string;
  @ApiProperty({ type: Object }) settings!: Record<string, unknown>;
  @ApiProperty() isActive!: boolean;
}

export class DeletedResponseDto {
  @ApiProperty() id!: string;
}
