import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProposalDto } from './create-proposal.dto';

/**
 * Editable proposal fields. `leadId` is immutable after creation, so it is
 * omitted from the update surface.
 */
export class UpdateProposalDto extends PartialType(
  OmitType(CreateProposalDto, ['leadId'] as const),
) {}
