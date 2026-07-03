import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApprovalDecisionDto {
  @ApiPropertyOptional({ description: 'Optional reason for the decision' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
