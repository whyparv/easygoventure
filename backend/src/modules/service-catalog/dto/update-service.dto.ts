import { PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';

/** All service fields are optional on update. */
export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
