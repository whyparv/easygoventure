import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ParseInquiryDto {
  @ApiProperty({
    example: 'Need Dubai visa for 2 adults on 15 July.',
    description: 'Raw inbound inquiry text (e.g. a WhatsApp message)',
  })
  @IsString()
  @MinLength(3)
  text!: string;
}
