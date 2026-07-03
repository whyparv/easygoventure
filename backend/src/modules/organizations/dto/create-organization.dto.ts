import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme DMC' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'acme-dmc', description: 'Unique tenant slug' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  slug!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({ example: 'Asia/Dubai' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'FREE' })
  @IsString()
  @IsOptional()
  subscriptionPlan?: string;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}
