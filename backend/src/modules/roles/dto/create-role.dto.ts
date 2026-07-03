import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'REGIONAL_SALES', description: 'Unique role code within the org' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  code!: string;

  @ApiProperty({ example: 'Regional Sales' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ type: [String], example: ['lead.read', 'lead.create'] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}
