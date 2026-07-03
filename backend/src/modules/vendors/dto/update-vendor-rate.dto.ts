import { PartialType } from '@nestjs/swagger';
import { CreateVendorRateDto } from './create-vendor-rate.dto';

/** All vendor-rate fields are optional on update. */
export class UpdateVendorRateDto extends PartialType(CreateVendorRateDto) {}
