import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePackageItemDto } from './create-package-item.dto';

/** `type` is fixed at creation; everything else may be updated (triggers recalc). */
export class UpdatePackageItemDto extends PartialType(
  OmitType(CreatePackageItemDto, ['type'] as const),
) {}
