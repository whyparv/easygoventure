import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ProposalStatus, ProposalType } from '../schemas/proposal.schema';

export class QueryProposalDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by lead' })
  @IsOptional()
  @IsMongoId()
  leadId?: string;

  @ApiPropertyOptional({ enum: ProposalStatus })
  @IsOptional()
  @IsEnum(ProposalStatus)
  status?: ProposalStatus;

  @ApiPropertyOptional({ enum: ProposalType })
  @IsOptional()
  @IsEnum(ProposalType)
  proposalType?: ProposalType;
}
