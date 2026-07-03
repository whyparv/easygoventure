import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryServiceDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by service category code', example: 'VISA' })
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
