import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { BaseEntity } from '../../../common/entities/base.entity';
import { QuotationStatus } from '../schemas/quotation.schema';

export class RejectQuotationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}

export class QuotationResponseDto extends BaseEntity {
  @ApiProperty() organizationId!: string;
  @ApiProperty() packageId!: string;
  @ApiProperty({ example: 'QUO-2026-04831' }) quotationNumber!: string;
  @ApiProperty() version!: number;
  @ApiProperty() currency!: string;
  @ApiProperty() customerPrice!: number;
  @ApiPropertyOptional() validUntil?: Date;
  @ApiPropertyOptional() notes?: string;
  @ApiProperty({ enum: QuotationStatus }) status!: QuotationStatus;
  @ApiProperty({ type: Object, description: 'Immutable frozen pricing snapshot' })
  snapshot!: Record<string, unknown>;
  @ApiPropertyOptional() sentAt?: Date;
  @ApiPropertyOptional() acceptedAt?: Date;
  @ApiPropertyOptional() rejectedAt?: Date;
}
