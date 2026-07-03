import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ApiStandardResponse } from '../../common/decorators/api-standard-response.decorator';
import { ApiStandardErrors } from '../../common/decorators/api-standard-errors.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../auth/rbac/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BookingsService } from './bookings.service';
import {
  BookingResponseDto,
  ConfirmBookingDto,
  CreateBookingDto,
  FailBookingDto,
  UpdateBookingDto,
} from './dto/booking.dto';
import {
  UpdateHotelDetailsDto,
  UpdateTransferDetailsDto,
  UpdateVisaProcessingDto,
} from './dto/booking-details.dto';

@ApiTags('operations-bookings')
@ApiStandardErrors()
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('proposals/:proposalId/bookings')
  @RequirePermissions(PERMISSIONS.BOOKING_CREATE)
  @ApiOperation({ summary: 'Create a supplier booking for a proposal' })
  @ApiStandardResponse(BookingResponseDto, { status: 201 })
  async create(
    @Param('proposalId') proposalId: string,
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.bookings.create(proposalId, dto, user), 'Booking created');
  }

  @Get('proposals/:proposalId/bookings')
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: 'List a proposal’s supplier bookings' })
  @ApiStandardResponse(BookingResponseDto, { array: true })
  async list(@Param('proposalId') proposalId: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.bookings.list(proposalId, user));
  }

  @Get('bookings/:id')
  @RequirePermissions(PERMISSIONS.BOOKING_READ)
  @ApiOperation({ summary: 'Get a booking by id' })
  @ApiStandardResponse(BookingResponseDto)
  async getOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.bookings.getOrThrow(id, user));
  }

  @Patch('bookings/:id')
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  @ApiOperation({ summary: 'Update booking references / dates / notes' })
  @ApiStandardResponse(BookingResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.bookings.update(id, dto, user), 'Booking updated');
  }

  @Post('bookings/:id/confirm')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.BOOKING_CONFIRM)
  @ApiOperation({ summary: 'Mark a booking confirmed by the supplier' })
  @ApiStandardResponse(BookingResponseDto)
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.bookings.confirm(id, dto, user), 'Booking confirmed');
  }

  @Post('bookings/:id/fail')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.BOOKING_CONFIRM)
  @ApiOperation({ summary: 'Mark a booking failed (supplier could not confirm)' })
  @ApiStandardResponse(BookingResponseDto)
  async fail(
    @Param('id') id: string,
    @Body() dto: FailBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.bookings.fail(id, dto, user), 'Booking failed');
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiStandardResponse(BookingResponseDto)
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return new ApiResponse(await this.bookings.cancel(id, user), 'Booking cancelled');
  }

  @Patch('bookings/:id/hotel-details')
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  @ApiOperation({ summary: 'Update hotel operational details' })
  @ApiStandardResponse(BookingResponseDto)
  async hotelDetails(
    @Param('id') id: string,
    @Body() dto: UpdateHotelDetailsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.bookings.updateHotelDetails(id, dto, user), 'Hotel details updated');
  }

  @Patch('bookings/:id/transfer-details')
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  @ApiOperation({ summary: 'Update transfer operational details' })
  @ApiStandardResponse(BookingResponseDto)
  async transferDetails(
    @Param('id') id: string,
    @Body() dto: UpdateTransferDetailsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.bookings.updateTransferDetails(id, dto, user), 'Transfer details updated');
  }

  @Patch('bookings/:id/visa-processing')
  @RequirePermissions(PERMISSIONS.BOOKING_UPDATE)
  @ApiOperation({ summary: 'Update visa processing milestones' })
  @ApiStandardResponse(BookingResponseDto)
  async visaProcessing(
    @Param('id') id: string,
    @Body() dto: UpdateVisaProcessingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return new ApiResponse(await this.bookings.updateVisaProcessing(id, dto, user), 'Visa processing updated');
  }
}
