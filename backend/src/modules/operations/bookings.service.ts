import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  BusinessException,
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/app.exceptions';
import { requireOrganizationId, tenantFilter } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { ProposalDocument } from '../proposals/schemas/proposal.schema';
import { BookingsRepository } from './bookings.repository';
import { Booking, BookingDocument, BookingStatus, BookingType } from './schemas/booking.schema';
import { HotelBookingDetails, HotelDetailStatus } from './schemas/hotel-booking-details.schema';
import {
  TransferBookingDetails,
  TransferDetailStatus,
} from './schemas/transfer-booking-details.schema';
import { VisaProcessing, VisaStatus } from './schemas/visa-processing.schema';
import { ConfirmBookingDto, CreateBookingDto, FailBookingDto, UpdateBookingDto } from './dto/booking.dto';
import {
  UpdateHotelDetailsDto,
  UpdateTransferDetailsDto,
  UpdateVisaProcessingDto,
} from './dto/booking-details.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly proposals: ProposalsRepository,
    private readonly audit: AuditService,
  ) {}

  async create(
    proposalId: string,
    dto: CreateBookingDto,
    user: AuthenticatedUser,
  ): Promise<BookingDocument> {
    const proposal = await this.ensureProposal(proposalId, user);
    const data: Partial<Booking> = {
      organizationId: requireOrganizationId(user),
      proposalId: new Types.ObjectId(proposal.id as string),
      bookingType: dto.bookingType,
      fulfillmentItemId: dto.fulfillmentItemId ? new Types.ObjectId(dto.fulfillmentItemId) : null,
      vendorId: dto.vendorId ? new Types.ObjectId(dto.vendorId) : null,
      bookingReference: dto.bookingReference,
      supplierReference: dto.supplierReference,
      travelDate: dto.travelDate ? new Date(dto.travelDate) : undefined,
      notes: dto.notes,
      status: BookingStatus.PENDING,
    };
    // Initialise the type-specific detail sub-document (defaults applied by schema).
    if (dto.bookingType === BookingType.HOTEL) data.hotelDetails = {} as HotelBookingDetails;
    if (dto.bookingType === BookingType.TRANSFER) data.transferDetails = {} as TransferBookingDetails;
    if (dto.bookingType === BookingType.VISA) data.visaProcessing = {} as VisaProcessing;

    const booking = await this.bookings.create(data);
    await this.audit.recordForActor(user, undefined, {
      action: 'booking.created',
      entity: 'Booking',
      entityId: booking.id as string,
      metadata: { proposalId, bookingType: dto.bookingType },
    });
    return booking;
  }

  async list(proposalId: string, user: AuthenticatedUser): Promise<BookingDocument[]> {
    const proposal = await this.ensureProposal(proposalId, user);
    return this.bookings.findByProposal(tenantFilter(user), new Types.ObjectId(proposal.id as string));
  }

  async getOrThrow(id: string, user: AuthenticatedUser): Promise<BookingDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationException(`"${id}" is not a valid id`, 'INVALID_ID');
    }
    const booking = await this.bookings.findByIdScoped(id, tenantFilter(user));
    if (!booking) throw new NotFoundException(`Booking "${id}" not found`, 'BOOKING_NOT_FOUND');
    return booking;
  }

  async update(id: string, dto: UpdateBookingDto, user: AuthenticatedUser): Promise<BookingDocument> {
    const booking = await this.getOrThrow(id, user);
    if (dto.vendorId !== undefined) booking.vendorId = new Types.ObjectId(dto.vendorId);
    if (dto.bookingReference !== undefined) booking.bookingReference = dto.bookingReference;
    if (dto.supplierReference !== undefined) booking.supplierReference = dto.supplierReference;
    if (dto.travelDate !== undefined) booking.travelDate = new Date(dto.travelDate);
    if (dto.notes !== undefined) booking.notes = dto.notes;
    await booking.save();
    await this.auditUpdate(user, booking, {});
    return booking;
  }

  /** Mark a booking CONFIRMED (records confirmation refs + date; confirms hotel/transfer detail). */
  async confirm(id: string, dto: ConfirmBookingDto, user: AuthenticatedUser): Promise<BookingDocument> {
    const booking = await this.getOrThrow(id, user);
    this.assertActive(booking);
    booking.status = BookingStatus.CONFIRMED;
    booking.confirmationDate = dto.confirmationDate ? new Date(dto.confirmationDate) : new Date();
    if (dto.bookingReference !== undefined) booking.bookingReference = dto.bookingReference;
    if (dto.supplierReference !== undefined) booking.supplierReference = dto.supplierReference;
    if (booking.hotelDetails) booking.hotelDetails.status = HotelDetailStatus.CONFIRMED;
    if (booking.transferDetails) booking.transferDetails.status = TransferDetailStatus.CONFIRMED;
    await booking.save();
    await this.audit.recordForActor(user, undefined, {
      action: 'booking.confirmed',
      entity: 'Booking',
      entityId: id,
      newValue: { supplierReference: booking.supplierReference ?? null },
    });
    return booking;
  }

  /** Mark a booking FAILED (supplier could not confirm). */
  async fail(id: string, dto: FailBookingDto, user: AuthenticatedUser): Promise<BookingDocument> {
    const booking = await this.getOrThrow(id, user);
    booking.status = BookingStatus.FAILED;
    if (dto.reason) booking.notes = dto.reason;
    await booking.save();
    await this.audit.recordForActor(user, undefined, {
      action: 'booking.failed',
      entity: 'Booking',
      entityId: id,
      metadata: { reason: dto.reason ?? null },
    });
    return booking;
  }

  async cancel(id: string, user: AuthenticatedUser): Promise<BookingDocument> {
    const booking = await this.getOrThrow(id, user);
    booking.status = BookingStatus.CANCELLED;
    await booking.save();
    await this.auditUpdate(user, booking, { cancelled: true });
    return booking;
  }

  // ── Type-specific operational details ────────────────────────────────────

  async updateHotelDetails(
    id: string,
    dto: UpdateHotelDetailsDto,
    user: AuthenticatedUser,
  ): Promise<BookingDocument> {
    const booking = await this.getOrThrow(id, user);
    this.assertType(booking, BookingType.HOTEL);
    if (!booking.hotelDetails) booking.hotelDetails = {} as HotelBookingDetails;
    const d = booking.hotelDetails;
    if (dto.hotelName !== undefined) d.hotelName = dto.hotelName;
    if (dto.checkInDate !== undefined) d.checkInDate = new Date(dto.checkInDate);
    if (dto.checkOutDate !== undefined) d.checkOutDate = new Date(dto.checkOutDate);
    if (dto.roomCount !== undefined) d.roomCount = dto.roomCount;
    if (dto.roomType !== undefined) d.roomType = dto.roomType;
    if (dto.confirmationNumber !== undefined) d.confirmationNumber = dto.confirmationNumber;
    if (dto.specialRequests !== undefined) d.specialRequests = dto.specialRequests;
    if (dto.status !== undefined) d.status = dto.status;
    await booking.save();
    await this.auditUpdate(user, booking, { detail: 'hotel' });
    return booking;
  }

  async updateTransferDetails(
    id: string,
    dto: UpdateTransferDetailsDto,
    user: AuthenticatedUser,
  ): Promise<BookingDocument> {
    const booking = await this.getOrThrow(id, user);
    this.assertType(booking, BookingType.TRANSFER);
    if (!booking.transferDetails) booking.transferDetails = {} as TransferBookingDetails;
    const d = booking.transferDetails;
    if (dto.pickupLocation !== undefined) d.pickupLocation = dto.pickupLocation;
    if (dto.dropLocation !== undefined) d.dropLocation = dto.dropLocation;
    if (dto.pickupTime !== undefined) d.pickupTime = new Date(dto.pickupTime);
    if (dto.driverName !== undefined) d.driverName = dto.driverName;
    if (dto.driverPhone !== undefined) d.driverPhone = dto.driverPhone;
    if (dto.vehicleType !== undefined) d.vehicleType = dto.vehicleType;
    if (dto.vehicleNumber !== undefined) d.vehicleNumber = dto.vehicleNumber;
    if (dto.status !== undefined) d.status = dto.status;
    await booking.save();
    await this.auditUpdate(user, booking, { detail: 'transfer' });
    return booking;
  }

  async updateVisaProcessing(
    id: string,
    dto: UpdateVisaProcessingDto,
    user: AuthenticatedUser,
  ): Promise<BookingDocument> {
    const booking = await this.getOrThrow(id, user);
    this.assertType(booking, BookingType.VISA);
    if (!booking.visaProcessing) booking.visaProcessing = {} as VisaProcessing;
    const d = booking.visaProcessing;
    if (dto.passportReceivedAt !== undefined) d.passportReceivedAt = new Date(dto.passportReceivedAt);
    if (dto.applicationSubmittedAt !== undefined) d.applicationSubmittedAt = new Date(dto.applicationSubmittedAt);
    if (dto.processingStartedAt !== undefined) d.processingStartedAt = new Date(dto.processingStartedAt);
    if (dto.approvedAt !== undefined) d.approvedAt = new Date(dto.approvedAt);
    if (dto.rejectedAt !== undefined) d.rejectedAt = new Date(dto.rejectedAt);
    if (dto.documents !== undefined) d.documents = dto.documents;
    if (dto.notes !== undefined) d.notes = dto.notes;

    let milestone: string | null = null;
    if (dto.status !== undefined && dto.status !== d.status) {
      d.status = dto.status;
      const now = new Date();
      if (dto.status === VisaStatus.SUBMITTED) {
        d.applicationSubmittedAt ??= now;
        milestone = 'visa.submitted';
      } else if (dto.status === VisaStatus.PROCESSING) {
        d.processingStartedAt ??= now;
      } else if (dto.status === VisaStatus.APPROVED) {
        d.approvedAt ??= now;
        milestone = 'visa.approved';
      } else if (dto.status === VisaStatus.REJECTED) {
        d.rejectedAt ??= now;
      }
    }
    await booking.save();

    if (milestone) {
      await this.audit.recordForActor(user, undefined, {
        action: milestone,
        entity: 'Booking',
        entityId: id,
        metadata: { proposalId: booking.proposalId.toString() },
      });
    } else {
      await this.auditUpdate(user, booking, { detail: 'visa' });
    }
    return booking;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private assertType(booking: BookingDocument, type: BookingType): void {
    if (booking.bookingType !== type) {
      throw new BusinessException(
        `This operation requires a ${type} booking (is ${booking.bookingType})`,
        'BOOKING_TYPE_MISMATCH',
      );
    }
  }

  private assertActive(booking: BookingDocument): void {
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BusinessException('A cancelled booking cannot be modified', 'BOOKING_CANCELLED');
    }
  }

  private async auditUpdate(
    user: AuthenticatedUser,
    booking: BookingDocument,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.recordForActor(user, undefined, {
      action: 'booking.updated',
      entity: 'Booking',
      entityId: booking.id as string,
      metadata,
      newValue: { status: booking.status },
    });
  }

  private async ensureProposal(
    proposalId: string,
    user: AuthenticatedUser,
  ): Promise<ProposalDocument> {
    if (!Types.ObjectId.isValid(proposalId)) {
      throw new ValidationException(`"${proposalId}" is not a valid id`, 'INVALID_ID');
    }
    const proposal = await this.proposals.findById(proposalId, tenantFilter(user));
    if (!proposal) throw new NotFoundException(`Proposal "${proposalId}" not found`, 'PROPOSAL_NOT_FOUND');
    return proposal;
  }
}
