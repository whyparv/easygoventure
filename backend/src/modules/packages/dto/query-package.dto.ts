import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { PackageStatus } from '../schemas/package.schema';

export class QueryPackageDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PackageStatus })
  @IsEnum(PackageStatus)
  @IsOptional()
  status?: PackageStatus;

  @ApiPropertyOptional({ description: 'Filter by inquiry id' })
  @IsMongoId()
  @IsOptional()
  inquiryId?: string;
}
