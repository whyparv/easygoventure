import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { InquirySource, InquiryStatus } from '../schemas/inquiry.schema';

export class InquiryResponseDto extends BaseEntity {
  @ApiProperty() organizationId!: string;
  @ApiProperty() referenceNo!: string;
  @ApiProperty({ enum: InquirySource }) source!: InquirySource;
  @ApiProperty({ enum: InquiryStatus }) status!: InquiryStatus;
  @ApiProperty() customerName!: string;
  @ApiPropertyOptional() customerPhone?: string;
  @ApiPropertyOptional() customerEmail?: string;
  @ApiPropertyOptional() companyName?: string;
  @ApiPropertyOptional() destination?: string;
  @ApiPropertyOptional() serviceCategoryCode?: string;
  @ApiPropertyOptional() travelers?: number;
  @ApiPropertyOptional() travelDate?: Date;
  @ApiPropertyOptional() budget?: number;
  @ApiPropertyOptional() rawInquiry?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiPropertyOptional({ nullable: true }) assignedToUserId?: string | null;
  @ApiPropertyOptional({ nullable: true }) convertedLeadId?: string | null;
}

export class DeletedResponseDto {
  @ApiProperty() id!: string;
}
