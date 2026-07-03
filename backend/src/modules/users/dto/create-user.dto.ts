import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsBoolean,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '../schemas/user.schema';

export class CreateUserDto {
  @ApiProperty({ example: 'agent@acme-dmc.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, description: 'Min 8 characters' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty() @IsString() @MinLength(1) firstName!: string;
  @ApiProperty() @IsString() @MinLength(1) lastName!: string;

  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;

  @ApiPropertyOptional({ description: 'Department id (must belong to the org)' })
  @IsMongoId()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Role ids to assign' })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  roleIds?: string[];

  @ApiPropertyOptional({ description: 'Target org id (super-admin only)' })
  @IsMongoId()
  @IsOptional()
  organizationId?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Force a password change on first login' })
  @IsBoolean()
  @IsOptional()
  mustChangePassword?: boolean;
}
