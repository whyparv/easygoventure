import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TenantScopedRepository } from '../../common/database/tenant-scoped.repository';
import { Booking, BookingDocument } from './schemas/booking.schema';

@Injectable()
export class BookingsRepository extends TenantScopedRepository<BookingDocument> {
  constructor(@InjectModel(Booking.name) model: Model<BookingDocument>) {
    super(model);
  }

  create(data: Partial<Booking>): Promise<BookingDocument> {
    return this.model.create(data);
  }

  /** All non-deleted bookings for a proposal, tenant-scoped (chronological). */
  findByProposal(
    scope: FilterQuery<BookingDocument>,
    proposalId: Types.ObjectId,
  ): Promise<BookingDocument[]> {
    return this.model
      .find({ ...scope, proposalId, isDeleted: { $ne: true } })
      .sort({ travelDate: 1, createdAt: 1 })
      .exec();
  }

  /** Bookings matching an arbitrary tenant-scoped filter (dashboard/risk sweeps). */
  findScoped(
    scope: FilterQuery<BookingDocument>,
    filter: FilterQuery<BookingDocument> = {},
  ): Promise<BookingDocument[]> {
    return this.model
      .find({ ...scope, ...filter, isDeleted: { $ne: true } })
      .sort({ travelDate: 1 })
      .exec();
  }
}
