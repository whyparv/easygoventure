import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateVendorDto {
  @ApiProperty({ example: 'Emirates Holidays' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ example: '+971500000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'sales@emirates-holidays.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: "Service category codes the vendor supports, e.g. 'HOTEL', 'VISA'",
    type: [String],
    example: ['HOTEL', 'VISA'],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedServices?: string[];

  @ApiPropertyOptional({ example: 'Net 30' })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
