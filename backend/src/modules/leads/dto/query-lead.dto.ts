import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { InquiryType, LeadSource, LeadStatus } from '../schemas/lead.schema';

export class QueryLeadDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: InquiryType })
  @IsOptional()
  @IsEnum(InquiryType)
  inquiryType?: InquiryType;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;
}
