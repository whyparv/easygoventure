import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { BaseEntity } from '../../../common/entities/base.entity';
import { BookingStatus, BookingType } from '../schemas/booking.schema';

export class CreateBookingDto {
  @ApiProperty({ enum: BookingType })
  @IsEnum(BookingType)
  bookingType!: BookingType;

  @ApiPropertyOptional({ description: 'Fulfillment line this booking satisfies' })
  @IsMongoId()
  @IsOptional()
  fulfillmentItemId?: string;

  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bookingReference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supplierReference?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  travelDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateBookingDto {
  @ApiPropertyOptional()
  @IsMongoId()
  @IsOptional()
  vendorId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bookingReference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supplierReference?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  travelDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ConfirmBookingDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bookingReference?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supplierReference?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsDateString()
  @IsOptional()
  confirmationDate?: string;
}

export class FailBookingDto {
  @ApiPropertyOptional({ description: 'Why the supplier booking failed' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class BookingResponseDto extends BaseEntity {
  @ApiProperty() organizationId!: string;
  @ApiProperty() proposalId!: string;
  @ApiPropertyOptional() fulfillmentItemId?: string;
  @ApiPropertyOptional() vendorId?: string;
  @ApiProperty({ enum: BookingType }) bookingType!: BookingType;
  @ApiPropertyOptional() bookingReference?: string;
  @ApiPropertyOptional() supplierReference?: string;
  @ApiPropertyOptional({ format: 'date-time' }) confirmationDate?: Date;
  @ApiPropertyOptional({ format: 'date-time' }) travelDate?: Date;
  @ApiPropertyOptional() notes?: string;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiPropertyOptional({ type: Object }) hotelDetails?: Record<string, unknown> | null;
  @ApiPropertyOptional({ type: Object }) transferDetails?: Record<string, unknown> | null;
  @ApiPropertyOptional({ type: Object }) visaProcessing?: Record<string, unknown> | null;
}
