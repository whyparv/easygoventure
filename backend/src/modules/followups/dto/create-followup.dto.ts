import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateFollowUpDto {
  @ApiProperty({ description: 'Lead to follow up with' })
  @IsMongoId()
  leadId!: string;

  @ApiProperty({ example: '2026-06-28T10:00:00.000Z' })
  @IsISO8601()
  scheduledDate!: string;

  @ApiPropertyOptional({ example: 'Call to confirm visa documents.' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextAction?: string;
}
