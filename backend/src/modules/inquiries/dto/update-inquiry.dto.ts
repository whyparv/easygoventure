import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateInquiryDto } from './create-inquiry.dto';

/** Source is fixed at creation; status changes go through the transition endpoint. */
export class UpdateInquiryDto extends PartialType(
  OmitType(CreateInquiryDto, ['source'] as const),
) {}
