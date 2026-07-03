import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryVendorRateDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter rates by vendor id' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Filter by active state' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
