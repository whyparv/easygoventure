import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { BookingsService } from './bookings.service';
import { TravelersService } from './travelers.service';
import { BookingDocument, BookingType } from './schemas/booking.schema';
import { hotelDetailMetrics } from './schemas/hotel-booking-details.schema';

export interface TimelineEvent {
  date: Date | null;
  type: string;
  category: BookingType | 'VISA_MILESTONE';
  title: string;
  detail?: string;
  status: string;
  bookingId: string;
}

export interface TripTimeline {
  proposalId: string;
  generatedAt: Date;
  travelerCount: number;
  eventCount: number;
  start: Date | null;
  end: Date | null;
  events: TimelineEvent[];
}

/**
 * TravelTimelineService — derives a proposal's complete, chronological trip
 * itinerary from its bookings (hotel stays, transfers, activities, flights) and
 * visa milestones. The timeline is ALWAYS derived, never manually maintained.
 */
@Injectable()
export class TravelTimelineService {
  constructor(
    private readonly bookings: BookingsService,
    private readonly travelers: TravelersService,
    private readonly audit: AuditService,
  ) {}

  async forProposal(proposalId: string, user: AuthenticatedUser): Promise<TripTimeline> {
    const [bookings, travelerList] = await Promise.all([
      this.bookings.list(proposalId, user),
      this.travelers.list(proposalId, user),
    ]);

    const events: TimelineEvent[] = [];
    for (const b of bookings) events.push(...this.eventsFor(b));

    const sorted = this.sortByDate(events);
    const dated = sorted.filter((e) => e.date).map((e) => (e.date as Date).getTime());
    const timeline: TripTimeline = {
      proposalId,
      generatedAt: new Date(),
      travelerCount: travelerList.length,
      eventCount: sorted.length,
      start: dated.length ? new Date(Math.min(...dated)) : null,
      end: dated.length ? new Date(Math.max(...dated)) : null,
      events: sorted,
    };

    await this.audit.recordForActor(user, undefined, {
      action: 'timeline.generated',
      entity: 'Proposal',
      entityId: proposalId,
      metadata: { events: sorted.length },
    });
    return timeline;
  }

  /** Derive the timeline events a single booking contributes. */
  private eventsFor(b: BookingDocument): TimelineEvent[] {
    const id = b.id as string;
    const out: TimelineEvent[] = [];

    if (b.bookingType === BookingType.HOTEL) {
      const h = b.hotelDetails;
      const name = h?.hotelName ?? 'Hotel';
      if (h?.checkInDate) {
        const { nights, roomNights } = hotelDetailMetrics(h);
        out.push({
          date: h.checkInDate,
          type: 'HOTEL_CHECK_IN',
          category: BookingType.HOTEL,
          title: `Check-in: ${name}`,
          detail: `${nights} night(s), ${roomNights} room-night(s)${h.roomType ? `, ${h.roomType}` : ''}`,
          status: h.status,
          bookingId: id,
        });
      }
      if (h?.checkOutDate) {
        out.push({
          date: h.checkOutDate,
          type: 'HOTEL_CHECK_OUT',
          category: BookingType.HOTEL,
          title: `Check-out: ${name}`,
          status: h.status,
          bookingId: id,
        });
      }
      if (!h?.checkInDate && !h?.checkOutDate) {
        out.push(this.genericEvent(b, 'HOTEL', `Hotel: ${name}`));
      }
    } else if (b.bookingType === BookingType.TRANSFER) {
      const t = b.transferDetails;
      const date = t?.pickupTime ?? b.travelDate ?? null;
      const route =
        t?.pickupLocation || t?.dropLocation
          ? `${t?.pickupLocation ?? '?'} → ${t?.dropLocation ?? '?'}`
          : 'Transfer';
      out.push({
        date,
        type: 'TRANSFER',
        category: BookingType.TRANSFER,
        title: `Transfer: ${route}`,
        detail: t?.vehicleType,
        status: t?.status ?? b.status,
        bookingId: id,
      });
    } else if (b.bookingType === BookingType.VISA) {
      out.push(...this.visaEvents(b));
    } else if (b.bookingType === BookingType.ACTIVITY) {
      out.push(this.genericEvent(b, 'ACTIVITY', b.notes ? `Activity: ${b.notes}` : 'Activity'));
    } else if (b.bookingType === BookingType.FLIGHT) {
      out.push(this.genericEvent(b, 'FLIGHT', b.notes ? `Flight: ${b.notes}` : 'Flight'));
    }
    return out;
  }

  private visaEvents(b: BookingDocument): TimelineEvent[] {
    const v = b.visaProcessing;
    const id = b.id as string;
    if (!v) return [this.genericEvent(b, 'VISA', 'Visa')];
    const milestones: Array<[Date | undefined, string, string]> = [
      [v.passportReceivedAt, 'VISA_PASSPORT_RECEIVED', 'Visa: passport received'],
      [v.applicationSubmittedAt, 'VISA_SUBMITTED', 'Visa: application submitted'],
      [v.processingStartedAt, 'VISA_PROCESSING', 'Visa: processing started'],
      [v.approvedAt, 'VISA_APPROVED', 'Visa: approved'],
      [v.rejectedAt, 'VISA_REJECTED', 'Visa: rejected'],
    ];
    const events = milestones
      .filter(([date]) => !!date)
      .map(([date, type, title]) => ({
        date: date as Date,
        type,
        category: 'VISA_MILESTONE' as const,
        title,
        status: v.status,
        bookingId: id,
      }));
    return events.length ? events : [this.genericEvent(b, 'VISA', 'Visa (pending documents)')];
  }

  private genericEvent(b: BookingDocument, type: string, title: string): TimelineEvent {
    return {
      date: b.travelDate ?? null,
      type,
      category: b.bookingType,
      title,
      status: b.status,
      bookingId: b.id as string,
    };
  }

  /** Chronological order; undated events sink to the end. */
  private sortByDate(events: TimelineEvent[]): TimelineEvent[] {
    return [...events].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.getTime() - b.date.getTime();
    });
  }
}
