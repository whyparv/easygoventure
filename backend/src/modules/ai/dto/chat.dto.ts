import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** A single prior turn in the conversation. */
export class ChatTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ example: 'What documents are needed for a Dubai tourist visa?' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}

export class ChatDto {
  @ApiProperty({
    example: 'A UK agent wants a 5-day Dubai package for 2 adults — what should I include?',
    description: 'The agent’s question or instruction for the assistant.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({
    type: [ChatTurnDto],
    description: 'Prior conversation turns (oldest first) for multi-turn context.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];

  @ApiPropertyOptional({
    description:
      'Optional CRM record the agent is currently viewing (e.g. a lead with its ' +
      'proposals, follow-ups and fulfillments), pre-rendered as text so the assistant ' +
      'can answer about the actual record.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  context?: string;
}
