import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { NotFoundException, ValidationException } from '../../common/exceptions/app.exceptions';
import { tenantFilter } from '../../common/tenant/tenant-scope';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { ProposalsRepository } from '../proposals/proposals.repository';
import { BookingsService } from './bookings.service';
import { TravelersService } from './travelers.service';
import { BookingDocument, BookingStatus, BookingType } from './schemas/booking.schema';
import { VisaStatus } from './schemas/visa-processing.schema';
import { TravelerStatus } from './schemas/traveler.schema';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

const RANK: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const HOURS = (days: number): number => days * 24;

export interface RiskIssue {
  code: string;
  level: RiskLevel;
  message: string;
  count?: number;
}

export interface ProposalRisk {
  proposalId: string;
  level: RiskLevel;
  departureDate: Date | null;
  hoursToDeparture: number | null;
  issues: RiskIssue[];
  assessedAt: Date;
}

/**
 * OperationalRiskService — assesses a proposal's operational readiness and
 * returns a LOW / MEDIUM / HIGH risk with the specific issues that drove it.
 * Severity escalates as the departure date approaches.
 */
@Injectable()
export class OperationalRiskService {
  constructor(
    private readonly proposals: ProposalsRepository,
    private readonly bookings: BookingsService,
    private readonly travelers: TravelersService,
    private readonly audit: AuditService,
  ) {}

  async assess(proposalId: string, user: AuthenticatedUser): Promise<ProposalRisk> {
    if (!Types.ObjectId.isValid(proposalId)) {
      throw new ValidationException(`"${proposalId}" is not a valid id`, 'INVALID_ID');
    }
    const proposal = await this.proposals.findById(proposalId, tenantFilter(user));
    if (!proposal) throw new NotFoundException(`Proposal "${proposalId}" not found`, 'PROPOSAL_NOT_FOUND');

    const [bookings, travelerList] = await Promise.all([
      this.bookings.list(proposalId, user),
      this.travelers.list(proposalId, user),
    ]);

    const activeTravelers = travelerList.filter((t) => t.status === TravelerStatus.ACTIVE);
    const departure = this.earliestDeparture(bookings, proposal.commercialSnapshot?.travelStartDate);
    const hours = departure ? (departure.getTime() - Date.now()) / 3_600_000 : null;
    const imminent = hours !== null && hours >= 0 && hours <= 72;

    const issues: RiskIssue[] = [];

    // 1. Missing traveler passports
    const noPassport = activeTravelers.filter((t) => !t.passportNumber?.trim()).length;
    if (noPassport > 0) {
      issues.push({
        code: 'MISSING_PASSPORTS',
        level: this.byLead(hours, HOURS(3), HOURS(14)),
        message: `${noPassport} traveler(s) missing a passport number`,
        count: noPassport,
      });
    }

    // 2. Unconfirmed hotels
    const unconfirmedHotels = this.unconfirmed(bookings, BookingType.HOTEL);
    if (unconfirmedHotels > 0) {
      issues.push({
        code: 'UNCONFIRMED_HOTELS',
        level: this.byLead(hours, HOURS(3), HOURS(14)),
        message: `${unconfirmedHotels} hotel booking(s) not confirmed`,
        count: unconfirmedHotels,
      });
    }

    // 3. Unconfirmed transfers
    const unconfirmedTransfers = this.unconfirmed(bookings, BookingType.TRANSFER);
    if (unconfirmedTransfers > 0) {
      issues.push({
        code: 'UNCONFIRMED_TRANSFERS',
        level: this.byLead(hours, HOURS(3), HOURS(14)),
        message: `${unconfirmedTransfers} transfer(s) not confirmed`,
        count: unconfirmedTransfers,
      });
    }

    // 4. Pending visas near departure (visa needs the most lead time)
    const pendingVisas = bookings.filter(
      (b) =>
        b.bookingType === BookingType.VISA &&
        b.status !== BookingStatus.CANCELLED &&
        b.visaProcessing?.status !== VisaStatus.APPROVED,
    ).length;
    if (pendingVisas > 0) {
      issues.push({
        code: 'PENDING_VISAS',
        level: this.byLead(hours, HOURS(14), HOURS(30)),
        message: `${pendingVisas} visa(s) not approved`,
        count: pendingVisas,
      });
    }

    // 5. Missing booking references on confirmed bookings
    const missingRefs = bookings.filter(
      (b) =>
        b.status === BookingStatus.CONFIRMED &&
        !b.bookingReference?.trim() &&
        !b.supplierReference?.trim(),
    ).length;
    if (missingRefs > 0) {
      issues.push({
        code: 'MISSING_BOOKING_REFERENCES',
        level: RiskLevel.MEDIUM,
        message: `${missingRefs} confirmed booking(s) have no reference number`,
        count: missingRefs,
      });
    }

    // 6. Travel within 72h without operational readiness
    if (imminent && (noPassport > 0 || unconfirmedHotels > 0 || unconfirmedTransfers > 0 || pendingVisas > 0)) {
      issues.push({
        code: 'IMMINENT_TRAVEL_NOT_READY',
        level: RiskLevel.HIGH,
        message: 'Travel within 72 hours with unresolved operational items',
      });
    }

    const level = issues.reduce<RiskLevel>(
      (max, i) => (RANK[i.level] > RANK[max] ? i.level : max),
      RiskLevel.LOW,
    );

    await this.audit.recordForActor(user, undefined, {
      action: 'risk.assessed',
      entity: 'Proposal',
      entityId: proposalId,
      newValue: { level, issues: issues.length },
    });

    return {
      proposalId,
      level,
      departureDate: departure,
      hoursToDeparture: hours === null ? null : Math.round(hours),
      issues,
      assessedAt: new Date(),
    };
  }

  private unconfirmed(bookings: BookingDocument[], type: BookingType): number {
    return bookings.filter(
      (b) =>
        b.bookingType === type &&
        b.status !== BookingStatus.CONFIRMED &&
        b.status !== BookingStatus.CANCELLED,
    ).length;
  }

  private earliestDeparture(
    bookings: BookingDocument[],
    snapshotStart?: Date | null,
  ): Date | null {
    const dates: number[] = [];
    for (const b of bookings) {
      if (b.status === BookingStatus.CANCELLED) continue;
      if (b.travelDate) dates.push(b.travelDate.getTime());
      if (b.hotelDetails?.checkInDate) dates.push(b.hotelDetails.checkInDate.getTime());
      if (b.transferDetails?.pickupTime) dates.push(b.transferDetails.pickupTime.getTime());
    }
    if (snapshotStart) dates.push(new Date(snapshotStart).getTime());
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates));
  }

  private byLead(hours: number | null, highWithin: number, medWithin: number): RiskLevel {
    if (hours === null) return RiskLevel.MEDIUM; // unknown timing → caution
    if (hours < 0) return RiskLevel.LOW; // departure already passed (in-progress/complete)
    if (hours <= highWithin) return RiskLevel.HIGH;
    if (hours <= medWithin) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }
}
