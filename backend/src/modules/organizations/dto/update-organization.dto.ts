import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateOrganizationDto } from './create-organization.dto';

/** Slug is immutable after creation, so it is omitted from updates. */
export class UpdateOrganizationDto extends PartialType(
  OmitType(CreateOrganizationDto, ['slug'] as const),
) {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
