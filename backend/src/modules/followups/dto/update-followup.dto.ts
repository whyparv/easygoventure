import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { FollowUpOutcome } from '../schemas/followup.schema';

export class UpdateFollowUpDto {
  @ApiPropertyOptional({ example: '2026-06-29T10:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  scheduledDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({
    enum: FollowUpOutcome,
    description: 'Recording an outcome marks the follow-up as completed',
  })
  @IsOptional()
  @IsEnum(FollowUpOutcome)
  outcome?: FollowUpOutcome;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextAction?: string;
}
