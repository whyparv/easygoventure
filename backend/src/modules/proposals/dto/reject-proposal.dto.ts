import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectProposalDto {
  @ApiPropertyOptional({ example: 'Client found a cheaper option.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
