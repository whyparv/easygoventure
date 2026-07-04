import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryServiceDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by service category code', example: 'VISA' })
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional({ description: 'Filter by destination', example: 'Dubai' })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional({ description: 'Filter by variant group', example: 'Airport Transfer' })
  @IsOptional()
  @IsString()
  variantGroup?: string;

  // A string ('true' | 'false') rather than a boolean: the global
  // `enableImplicitConversion` coerces any boolean query param truthily, which
  // silently broke `isActive=false`. Coerced to a real boolean in the service.
  @ApiPropertyOptional({ description: 'Filter by active status', enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  @IsIn(['true', 'false'])
  isActive?: string;
}
