import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAuditDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by action, e.g. "user.login"' })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by entity type, e.g. "Vendor"' })
  @IsString()
  @IsOptional()
  entity?: string;

  @ApiPropertyOptional({ description: 'Filter by entity id' })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Filter by acting user id' })
  @IsString()
  @IsOptional()
  userId?: string;
}
