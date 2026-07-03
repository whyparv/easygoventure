import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { QuotationStatus } from '../schemas/quotation.schema';

export class QueryQuotationDto extends PaginationDto {
  @ApiPropertyOptional({ enum: QuotationStatus })
  @IsEnum(QuotationStatus)
  @IsOptional()
  status?: QuotationStatus;

  @ApiPropertyOptional({ description: 'Filter by package id' })
  @IsMongoId()
  @IsOptional()
  packageId?: string;
}
