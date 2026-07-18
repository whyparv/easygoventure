import type { LeadHotelOption } from '@shared/types/domain';

export const INTERNAL_CURRENCY = 'AED';
export const CUSTOMER_CURRENCY = 'USD';
export const AED_PER_USD = 3.6725;
export const DEFAULT_ROOM_OCCUPANCY = 2;
export const ROOM_TYPE_SUGGESTIONS = [
  'Standard Room',
  'Regular Room',
  'Superior Room',
  'Deluxe Room',
  'Luxury Room',
  'Premium Room',
  'Executive Room',
  'Club Room',
  'Double Room',
  'Twin Room',
  'Junior Suite',
  'Suite',
  'Family Room',
  'Connecting Room',
  'City View Room',
  'Ocean View Room',
  'Palm View Room',
  'Burj View Room',
  'Pool View Room',
  'One Bedroom Suite',
  'Two Bedroom Suite',
  'Villa',
  'Apartment',
];

const USD_RATES: Record<string, number> = {
  USD: 1,
  AED: 1 / AED_PER_USD,
  INR: 0.012,
  EUR: 1.08,
  GBP: 1.27,
  SAR: 0.2666,
  QAR: 0.2747,
};

export function toUsd(amount: number, currency = CUSTOMER_CURRENCY): number {
  const rate = USD_RATES[(currency || CUSTOMER_CURRENCY).toUpperCase()] ?? 1;
  return amount * rate;
}

export function toInternalAed(amount: number, currency = INTERNAL_CURRENCY): number {
  const cur = (currency || INTERNAL_CURRENCY).toUpperCase();
  if (cur === INTERNAL_CURRENCY) return amount;
  return toUsd(amount, cur) * AED_PER_USD;
}

export function toCustomerUsd(amount: number, currency = INTERNAL_CURRENCY): number {
  return toUsd(amount, currency);
}

export function occupancyToMax(type?: string): number {
  if (type === 'SINGLE') return 1;
  if (type === 'TRIPLE') return 3;
  return DEFAULT_ROOM_OCCUPANCY; // 2 for DOUBLE or undefined
}

export function requiredRoomCount(
  pax: number,
  maxOccupancy = DEFAULT_ROOM_OCCUPANCY,
  requestedRooms?: number,
): number {
  // If the user/AI explicitly specified a room count, honour it — this covers
  // triple-sharing (3 pax, 1 double room) and other non-standard occupancy.
  if (requestedRooms != null && requestedRooms > 0) {
    return Math.max(1, Math.ceil(requestedRooms));
  }
  const safePax = Math.max(1, Math.ceil(pax || 1));
  const safeOccupancy = Math.max(1, Math.ceil(maxOccupancy || DEFAULT_ROOM_OCCUPANCY));
  return Math.ceil(safePax / safeOccupancy);
}

export function hotelTotalAed(pricePerNight: number, nights: number, rooms: number): number {
  return pricePerNight * Math.max(1, nights || 1) * Math.max(1, rooms || 1);
}

export function normalizeHotelOption(
  option: LeadHotelOption,
  {
    pax,
    fallbackNights = 1,
    fallbackCurrency = INTERNAL_CURRENCY,
  }: {
    pax: number;
    fallbackNights?: number;
    fallbackCurrency?: string;
  },
): LeadHotelOption {
  const sourceCurrency = option.currency ?? fallbackCurrency;
  const sourcePricePerNight =
    option.pricePerNight != null ? toInternalAed(option.pricePerNight, sourceCurrency) : undefined;
  const sourceTotalPrice =
    option.totalPrice != null ? toInternalAed(option.totalPrice, sourceCurrency) : undefined;
  const sourcePricePerPerson =
    option.pricePerPerson != null ? toInternalAed(option.pricePerPerson, sourceCurrency) : undefined;
  const maxOccupancy =
    option.maxOccupancy != null && option.maxOccupancy > 0
      ? Math.ceil(option.maxOccupancy)
      : occupancyToMax(option.occupancyType);
  // paxForOption: how many pax share THIS segment's room cost
  const paxForOption = option.paxCount != null && option.paxCount > 0 ? option.paxCount : pax;
  const nights = option.nights != null && option.nights > 0 ? option.nights : fallbackNights || 1;
  const roomCount = requiredRoomCount(paxForOption, maxOccupancy, option.roomCount);
  // All derived amounts are whole AED dirhams — round so the UI/quote never
  // shows fractional currency (e.g. "AED 333.33333/pax") after conversion.
  const rawPricePerNight =
    sourcePricePerNight ??
    (sourceTotalPrice != null
      ? sourceTotalPrice / (Math.max(1, nights) * roomCount)
      : sourcePricePerPerson != null
        ? (sourcePricePerPerson * Math.max(1, paxForOption)) / (Math.max(1, nights) * roomCount)
        : undefined);
  const pricePerNight = rawPricePerNight != null ? Math.round(rawPricePerNight) : undefined;
  const totalPrice =
    pricePerNight != null
      ? hotelTotalAed(pricePerNight, nights, roomCount)
      : sourceTotalPrice != null
        ? Math.round(sourceTotalPrice)
        : undefined;
  const pricePerPerson =
    totalPrice != null
      ? Math.round(totalPrice / Math.max(1, paxForOption))
      : sourcePricePerPerson != null
        ? Math.round(sourcePricePerPerson)
        : undefined;

  return {
    ...option,
    currency: INTERNAL_CURRENCY,
    maxOccupancy,
    nights,
    roomCount,
    pricePerNight,
    totalPrice,
    pricePerPerson,
  };
}

/** For mixed-occupancy packages, compute blended per-person hotel cost across all segments. */
export function blendedHotelCostPerPax(
  normalizedOptions: LeadHotelOption[],
  totalPax: number,
): number | null {
  const hasMixed = normalizedOptions.some((o) => o.paxCount != null && o.paxCount < totalPax && o.paxCount > 0);
  if (!hasMixed) return null; // caller should use recommended option normally
  let totalCost = 0;
  let totalAllocated = 0;
  for (const o of normalizedOptions) {
    const segPax = o.paxCount ?? totalPax;
    totalCost += (o.pricePerPerson ?? 0) * segPax;
    totalAllocated += segPax;
  }
  return totalAllocated > 0 ? totalCost / Math.max(1, totalPax) : null;
}
