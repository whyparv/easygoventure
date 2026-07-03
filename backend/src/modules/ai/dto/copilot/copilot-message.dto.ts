import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CopilotMessageDto {
  @ApiProperty({ example: 'Draft a follow-up for this inquiry.' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}
