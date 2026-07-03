import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

export class AuditLogResponseDto extends BaseEntity {
  @ApiPropertyOptional({ nullable: true }) organizationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) userId!: string | null;
  @ApiPropertyOptional() userEmail?: string;
  @ApiProperty() action!: string;
  @ApiProperty() entity!: string;
  @ApiPropertyOptional() entityId?: string;
  @ApiPropertyOptional({ type: Object }) oldValue?: Record<string, unknown>;
  @ApiPropertyOptional({ type: Object }) newValue?: Record<string, unknown>;
  @ApiPropertyOptional({ type: Object }) metadata?: Record<string, unknown>;
  @ApiPropertyOptional() ip?: string;
  @ApiPropertyOptional() userAgent?: string;
}
