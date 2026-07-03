import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { InquiryStatus } from '../schemas/inquiry.schema';

export class TransitionInquiryDto {
  @ApiProperty({ enum: InquiryStatus, description: 'Target lifecycle status' })
  @IsEnum(InquiryStatus)
  status!: InquiryStatus;
}
