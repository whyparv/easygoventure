import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Acme DMC', description: 'Your agency / organization name' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  organizationName!: string;

  @ApiProperty({ example: 'owner@acme-dmc.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, description: 'Min 8 characters' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Aisha' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Khan' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'owner@acme-dmc.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token of the session to revoke' })
  @IsString()
  @IsOptional()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'Revoke every active session for the user' })
  @IsBoolean()
  @IsOptional()
  allDevices?: boolean;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
