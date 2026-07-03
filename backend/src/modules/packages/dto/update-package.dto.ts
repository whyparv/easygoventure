import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreatePackageDto } from './create-package.dto';
import { PackageStatus } from '../schemas/package.schema';

/** `inquiryId` is set at creation; totals are derived and never accepted here. */
export class UpdatePackageDto extends PartialType(
  OmitType(CreatePackageDto, ['inquiryId'] as const),
) {
  @ApiPropertyOptional({ enum: PackageStatus })
  @IsEnum(PackageStatus)
  @IsOptional()
  status?: PackageStatus;
}
