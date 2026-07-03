import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RecordActionDto {
  @ApiPropertyOptional({ description: 'Owning copilot session id' })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({ example: 'create_followup' })
  @IsString()
  @MinLength(1)
  type!: string;

  @ApiProperty({ example: 'Schedule a follow-up in 3 days to confirm dates.' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  summary!: string;

  @ApiPropertyOptional({ type: Object, description: 'Validated action fields' })
  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Lead' })
  @IsString()
  @IsOptional()
  targetEntity?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  targetId?: string;
}
