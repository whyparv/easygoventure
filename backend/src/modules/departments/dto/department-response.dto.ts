import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

export class DepartmentResponseDto extends BaseEntity {
  @ApiProperty() organizationId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() isActive!: boolean;
}

export class DeletedResponseDto {
  @ApiProperty() id!: string;
}
