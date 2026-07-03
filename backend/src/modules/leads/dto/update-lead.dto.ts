import { PartialType } from '@nestjs/swagger';
import { CreateLeadDto } from './create-lead.dto';

/**
 * All lead fields are optional on update. Status transitions made here are
 * recorded on the lead timeline by the service.
 */
export class UpdateLeadDto extends PartialType(CreateLeadDto) {}
