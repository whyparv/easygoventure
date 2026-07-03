import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { FollowUpOutcome } from '../schemas/followup.schema';

export class QueryFollowUpDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by lead' })
  @IsOptional()
  @IsMongoId()
  leadId?: string;

  @ApiPropertyOptional({ enum: FollowUpOutcome })
  @IsOptional()
  @IsEnum(FollowUpOutcome)
  outcome?: FollowUpOutcome;

  @ApiPropertyOptional({
    description: 'true = only completed, false = only pending',
    example: 'false',
  })
  @IsOptional()
  @IsBooleanString()
  completed?: string;
}
