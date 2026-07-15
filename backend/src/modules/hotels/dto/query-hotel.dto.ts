import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryHotelDto extends PaginationDto {
  @ApiPropertyOptional({ enum: [3, 4, 5] })
  @Type(() => Number)
  @IsInt()
  @IsIn([3, 4, 5])
  @IsOptional()
  starRating?: number;

  @ApiPropertyOptional({ description: 'Filter by area (case-insensitive contains)' })
  @IsString()
  @IsOptional()
  area?: string;

  @ApiPropertyOptional({ description: 'Filter by city', default: 'Dubai' })
  @IsString()
  @IsOptional()
  city?: string;

}
