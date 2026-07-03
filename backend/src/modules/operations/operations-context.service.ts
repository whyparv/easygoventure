import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TravelersService } from './travelers.service';
import { BookingsService } from './bookings.service';
import { TravelTimelineService } from './travel-timeline.service';
import { OperationalRiskService } from './operational-risk.service';
import { BookingStatus } from './schemas/booking.schema';
import { TravelerStatus } from './schemas/traveler.schema';

export interface OperationsAiContext {
  type: 'operations';
  summary: string;
  data: Record<string, unknown>;
}

/**
 * OperationsContextProvider — AI INFRASTRUCTURE ONLY. A read-only assembly of the
 * operational picture (travelers, booking status, timeline, risk, pending actions,
 * upcoming departures) for future AI workflows. It performs NO booking, NO
 * confirmation and NO traveler modification — human approval remains mandatory.
 */
@Injectable()
export class OperationsContextService {
  constructor(
    private readonly travelers: TravelersService,
    private readonly bookings: BookingsService,
    private readonly timeline: TravelTimelineService,
    private readonly risk: OperationalRiskService,
  ) {}

  async forProposal(proposalId: string, user: AuthenticatedUser): Promise<OperationsAiContext> {
    const [travelerList, bookingList, timeline, risk] = await Promise.all([
      this.travelers.list(proposalId, user),
      this.bookings.list(proposalId, user),
      this.timeline.forProposal(proposalId, user),
      this.risk.assess(proposalId, user),
    ]);

    const active = travelerList.filter((t) => t.status === TravelerStatus.ACTIVE);
    const missingPassport = active.filter((t) => !t.passportNumber?.trim()).length;

    const bookingByStatus: Record<string, number> = {};
    const bookingByType: Record<string, number> = {};
    for (const b of bookingList) {
      bookingByStatus[b.status] = (bookingByStatus[b.status] ?? 0) + 1;
      bookingByType[b.bookingType] = (bookingByType[b.bookingType] ?? 0) + 1;
    }
    const confirmed = bookingByStatus[BookingStatus.CONFIRMED] ?? 0;

    const now = Date.now();
    const upcoming = timeline.events
      .filter((e) => e.date && e.date.getTime() >= now)
      .slice(0, 5)
      .map((e) => ({ date: e.date, title: e.title, status: e.status }));

    const data = {
      travelers: {
        total: travelerList.length,
        active: active.length,
        missingPassport,
      },
      bookings: {
        total: bookingList.length,
        confirmed,
        byStatus: bookingByStatus,
        byType: bookingByType,
      },
      timeline: {
        start: timeline.start,
        end: timeline.end,
        eventCount: timeline.eventCount,
      },
      upcomingDepartures: upcoming,
      risk: { level: risk.level, hoursToDeparture: risk.hoursToDeparture, issues: risk.issues },
      pendingActions: risk.issues.map((i) => i.message),
    };

    const summary =
      `Proposal ${proposalId}: ${active.length} active traveler(s) ` +
      `(${missingPassport} missing passport), ${confirmed}/${bookingList.length} booking(s) confirmed, ` +
      `operational risk ${risk.level}` +
      (risk.issues.length ? ` — ${risk.issues.length} issue(s).` : '.');

    return { type: 'operations', summary, data };
  }
}
