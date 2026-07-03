import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TravelerGender, TravelerStatus } from '../schemas/traveler.schema';

export class CreateTravelerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @ApiPropertyOptional({ enum: TravelerGender })
  @IsEnum(TravelerGender)
  @IsOptional()
  gender?: TravelerGender;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nationality?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  passportNumber?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateString()
  @IsOptional()
  passportExpiry?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateTravelerDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ enum: TravelerGender })
  @IsEnum(TravelerGender)
  @IsOptional()
  gender?: TravelerGender;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nationality?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  passportNumber?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsDateString()
  @IsOptional()
  passportExpiry?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ enum: TravelerStatus })
  @IsEnum(TravelerStatus)
  @IsOptional()
  status?: TravelerStatus;
}

export class TravelerResponseDto extends BaseEntity {
  @ApiProperty() organizationId!: string;
  @ApiProperty() proposalId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: TravelerGender }) gender!: TravelerGender;
  @ApiPropertyOptional({ format: 'date' }) dateOfBirth?: Date;
  @ApiPropertyOptional() nationality?: string;
  @ApiPropertyOptional() passportNumber?: string;
  @ApiPropertyOptional({ format: 'date' }) passportExpiry?: Date;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiProperty({ enum: TravelerStatus }) status!: TravelerStatus;
}
