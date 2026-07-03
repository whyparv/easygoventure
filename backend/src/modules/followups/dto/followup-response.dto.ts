import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FollowUpOutcome } from '../schemas/followup.schema';

/** Documentation shape for a Follow-up returned by the API. */
export class FollowUpResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Owning organization (tenant)' })
  organizationId!: string;

  @ApiProperty()
  leadId!: string;

  @ApiProperty({ format: 'date-time' })
  scheduledDate!: string;

  @ApiPropertyOptional()
  remarks?: string;

  @ApiPropertyOptional({ enum: FollowUpOutcome })
  outcome?: FollowUpOutcome;

  @ApiPropertyOptional()
  nextAction?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  completedAt?: string;

  @ApiProperty({ default: false })
  isDeleted!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
