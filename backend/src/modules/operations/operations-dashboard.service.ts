import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { tenantFilter } from '../../common/tenant/tenant-scope';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { ProposalBookingStatus } from '../proposals/schemas/proposal.schema';
import { BookingsRepository } from './bookings.repository';
import { TravelersRepository } from './travelers.repository';
import { BookingStatus, BookingType } from './schemas/booking.schema';
import { VisaStatus } from './schemas/visa-processing.schema';
import { TravelerStatus } from './schemas/traveler.schema';

export interface OperationsDashboard {
  generatedAt: Date;
  upcomingDepartures: number;
  tripsInProgress: number;
  bookedTrips: number;
  completedTrips: number;
  pendingHotelConfirmations: number;
  pendingTransfers: number;
  pendingActivities: number;
  pendingVisas: number;
  travelersInTransit: number;
  bookingSuccessRate: number;
}

/**
 * OperationsDashboardService — tenant-scoped operational metrics. Super-admins
 * get a platform-wide roll-up; everyone else is hard-scoped to their org (via
 * `tenantFilter`). Every underlying query embeds that scope.
 */
@Injectable()
export class OperationsDashboardService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly travelers: TravelersRepository,
    private readonly proposals: ProposalsRepository,
    private readonly audit: AuditService,
  ) {}

  async getDashboard(user: AuthenticatedUser): Promise<OperationsDashboard> {
    const scope = tenantFilter(user);
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const pendingStates = { $in: [BookingStatus.PENDING, BookingStatus.REQUESTED] };

    const inProgressIds = await this.proposals.findIdsScoped(scope, {
      bookingStatus: ProposalBookingStatus.FULFILLING,
    });

    const [
      upcomingDepartures,
      tripsInProgress,
      bookedTrips,
      completedTrips,
      pendingHotelConfirmations,
      pendingTransfers,
      pendingActivities,
      pendingVisas,
      travelersInTransit,
      confirmedBookings,
      activeBookings,
    ] = await Promise.all([
      this.bookings.countScoped(scope, {
        travelDate: { $gte: now, $lte: in7Days },
        status: { $ne: BookingStatus.CANCELLED },
      }),
      this.proposals.countScoped(scope, { bookingStatus: ProposalBookingStatus.FULFILLING }),
      this.proposals.countScoped(scope, { bookingStatus: ProposalBookingStatus.BOOKED }),
      this.proposals.countScoped(scope, { bookingStatus: ProposalBookingStatus.COMPLETED }),
      this.bookings.countScoped(scope, { bookingType: BookingType.HOTEL, status: pendingStates }),
      this.bookings.countScoped(scope, { bookingType: BookingType.TRANSFER, status: pendingStates }),
      this.bookings.countScoped(scope, { bookingType: BookingType.ACTIVITY, status: pendingStates }),
      this.bookings.countScoped(scope, {
        bookingType: BookingType.VISA,
        status: { $ne: BookingStatus.CANCELLED },
        'visaProcessing.status': { $ne: VisaStatus.APPROVED },
      }),
      inProgressIds.length
        ? this.travelers.countScoped(scope, {
            proposalId: { $in: inProgressIds },
            status: TravelerStatus.ACTIVE,
          })
        : Promise.resolve(0),
      this.bookings.countScoped(scope, { status: BookingStatus.CONFIRMED }),
      this.bookings.countScoped(scope, { status: { $ne: BookingStatus.CANCELLED } }),
    ]);

    const bookingSuccessRate =
      activeBookings > 0 ? Math.round((confirmedBookings / activeBookings) * 10000) / 100 : 0;

    await this.audit.recordForActor(user, undefined, {
      action: 'dashboard.generated',
      entity: 'OperationsDashboard',
      metadata: { scope: user.isSuperAdmin ? 'platform' : 'organization' },
    });

    return {
      generatedAt: now,
      upcomingDepartures,
      tripsInProgress,
      bookedTrips,
      completedTrips,
      pendingHotelConfirmations,
      pendingTransfers,
      pendingActivities,
      pendingVisas,
      travelersInTransit,
      bookingSuccessRate,
    };
  }
}
