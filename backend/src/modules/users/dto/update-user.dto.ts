import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../schemas/user.schema';

export class UpdateUserDto {
  @ApiPropertyOptional() @IsString() @IsOptional() firstName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() lastName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;

  @ApiPropertyOptional({ description: 'Department id, or null to clear' })
  @IsMongoId()
  @IsOptional()
  departmentId?: string | null;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
