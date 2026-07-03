import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserStatus } from '../schemas/user.schema';

/** Public shape of a user — never includes passwordHash or mfaSecret. */
export class UserResponseDto extends BaseEntity {
  @ApiPropertyOptional({ nullable: true }) organizationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) departmentId!: string | null;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiPropertyOptional() phone?: string;
  @ApiProperty({ type: [String] }) roleIds!: string[];
  @ApiProperty({ type: [String] }) directPermissions!: string[];
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;
  @ApiProperty() mfaEnabled!: boolean;
  @ApiPropertyOptional() lastLoginAt?: Date;
}

export class DeletedResponseDto {
  @ApiProperty() id!: string;
}
