import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { FulfillmentStatus, FulfillmentType } from '../schemas/fulfillment.schema';

export class QueryFulfillmentDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by lead' })
  @IsOptional()
  @IsMongoId()
  leadId?: string;

  @ApiPropertyOptional({ enum: FulfillmentStatus })
  @IsOptional()
  @IsEnum(FulfillmentStatus)
  status?: FulfillmentStatus;

  @ApiPropertyOptional({ enum: FulfillmentType })
  @IsOptional()
  @IsEnum(FulfillmentType)
  type?: FulfillmentType;
}
