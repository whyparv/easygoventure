import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { HotelDetailStatus } from '../schemas/hotel-booking-details.schema';
import { TransferDetailStatus } from '../schemas/transfer-booking-details.schema';
import { VisaStatus } from '../schemas/visa-processing.schema';

export class UpdateHotelDetailsDto {
  @ApiPropertyOptional() @IsString() @IsOptional() hotelName?: string;
  @ApiPropertyOptional({ format: 'date' }) @IsDateString() @IsOptional() checkInDate?: string;
  @ApiPropertyOptional({ format: 'date' }) @IsDateString() @IsOptional() checkOutDate?: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() roomCount?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() roomType?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() confirmationNumber?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() specialRequests?: string;
  @ApiPropertyOptional({ enum: HotelDetailStatus }) @IsEnum(HotelDetailStatus) @IsOptional() status?: HotelDetailStatus;
}

export class UpdateTransferDetailsDto {
  @ApiPropertyOptional() @IsString() @IsOptional() pickupLocation?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() dropLocation?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsDateString() @IsOptional() pickupTime?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() driverName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() driverPhone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() vehicleType?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() vehicleNumber?: string;
  @ApiPropertyOptional({ enum: TransferDetailStatus }) @IsEnum(TransferDetailStatus) @IsOptional() status?: TransferDetailStatus;
}

export class UpdateVisaProcessingDto {
  @ApiPropertyOptional({ format: 'date-time' }) @IsDateString() @IsOptional() passportReceivedAt?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsDateString() @IsOptional() applicationSubmittedAt?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsDateString() @IsOptional() processingStartedAt?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsDateString() @IsOptional() approvedAt?: string;
  @ApiPropertyOptional({ format: 'date-time' }) @IsDateString() @IsOptional() rejectedAt?: string;
  @ApiPropertyOptional({ type: [String] }) @IsArray() @IsString({ each: true }) @IsOptional() documents?: string[];
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional({ enum: VisaStatus }) @IsEnum(VisaStatus) @IsOptional() status?: VisaStatus;
}

export class GenerateDocumentDto {
  @ApiPropertyOptional({ description: 'External storage pointer (never the binary)' })
  @IsString()
  @IsOptional()
  storageRef?: string;

  @ApiPropertyOptional({ description: 'MIME/format the artifact will be rendered as' })
  @IsString()
  @IsOptional()
  format?: string;
}
