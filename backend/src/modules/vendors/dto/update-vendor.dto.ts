import { PartialType } from '@nestjs/swagger';
import { CreateVendorDto } from './create-vendor.dto';

/** All vendor fields are optional on update. */
export class UpdateVendorDto extends PartialType(CreateVendorDto) {}
