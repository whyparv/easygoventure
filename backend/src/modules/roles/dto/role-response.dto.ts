import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

export class RoleResponseDto extends BaseEntity {
  @ApiPropertyOptional({ nullable: true }) organizationId!: string | null;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ type: [String] }) permissions!: string[];
  @ApiProperty() scope!: string;
  @ApiProperty() isSystem!: boolean;
  @ApiProperty() isActive!: boolean;
}

export class DeletedResponseDto {
  @ApiProperty() id!: string;
}
