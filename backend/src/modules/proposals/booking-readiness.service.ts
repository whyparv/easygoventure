import { Injectable } from '@nestjs/common';
import { ProposalDocument } from './schemas/proposal.schema';

export interface ReadinessResult {
  ready: boolean;
  issues: string[];
  checks: {
    hasSnapshot: boolean;
    itemCount: number;
    itemsWithVendorReference: number;
    travelersValid: boolean;
    datesValid: boolean;
    pricingPresent: boolean;
  };
}

/**
 * BookingReadinessService — validates that a converted proposal is ready to be
 * turned into operational bookings. Pure (no I/O); operates on the frozen
 * commercial snapshot, so vendor/hotel references are validated as they were at
 * acceptance time.
 */
@Injectable()
export class BookingReadinessService {
  validate(proposal: ProposalDocument): ReadinessResult {
    const issues: string[] = [];
    const snap = proposal.commercialSnapshot;

    const hasSnapshot = !!snap;
    if (!hasSnapshot) issues.push('Missing commercial pricing snapshot');

    const items = snap?.items ?? [];
    const itemCount = items.length;
    if (hasSnapshot && itemCount === 0) issues.push('The proposal has no items to fulfil');

    const travelersValid = !!snap && snap.numberOfTravelers >= 1;
    if (hasSnapshot && !travelersValid) issues.push('Traveler count must be at least 1');

    const datesValid =
      !snap?.travelStartDate ||
      !snap?.travelEndDate ||
      new Date(snap.travelEndDate).getTime() >= new Date(snap.travelStartDate).getTime();
    if (!datesValid) issues.push('Travel end date precedes the start date');

    const pricingPresent = typeof proposal.acceptedPrice === 'number' && proposal.acceptedPrice > 0;
    if (!pricingPresent) issues.push('Missing accepted price');

    const itemsWithVendorReference = items.filter((i) => !!i.vendorRate?.vendorRateId).length;

    return {
      ready: issues.length === 0,
      issues,
      checks: {
        hasSnapshot,
        itemCount,
        itemsWithVendorReference,
        travelersValid,
        datesValid,
        pricingPresent,
      },
    };
  }
}
