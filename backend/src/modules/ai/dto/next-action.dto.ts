import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class NextActionDto {
  @ApiProperty({
    description:
      'The CRM record the agent is viewing (lead + proposals/follow-ups/fulfillments), ' +
      'pre-rendered as text. The recommended action is grounded in this record.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  context!: string;

  @ApiPropertyOptional({
    description: 'Optional steer from the agent, e.g. "focus on getting documents".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
