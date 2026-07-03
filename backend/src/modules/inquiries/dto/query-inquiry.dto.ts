import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { InquirySource, InquiryStatus } from '../schemas/inquiry.schema';

export class QueryInquiryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InquiryStatus })
  @IsEnum(InquiryStatus)
  @IsOptional()
  status?: InquiryStatus;

  @ApiPropertyOptional({ enum: InquirySource })
  @IsEnum(InquirySource)
  @IsOptional()
  source?: InquirySource;

  @ApiPropertyOptional({ description: 'ServiceCategory code, e.g. VISA' })
  @IsString()
  @IsOptional()
  serviceCategoryCode?: string;
}
