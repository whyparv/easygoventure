// Domain enums + entity types mirroring the NestJS/Mongoose backend.
import type { PackageSnapshot } from '@shared/types/ops-domain';

export const LeadSource = ['WHATSAPP', 'MANUAL', 'EMAIL'] as const;
export type LeadSource = (typeof LeadSource)[number];

export const InquiryType = ['VISA', 'TRAVEL_PACKAGE', 'HOTEL', 'TRANSFER', 'CUSTOM'] as const;
export type InquiryType = (typeof InquiryType)[number];

// The EasyGo Venture travel-inquiry pipeline. Every record is a Lead moving
// through these stages; REJECTED is the terminal closed/lost branch.
export const LeadStatus = [
  'NEW',
  'QUOTE_SENT',
  'FOLLOW_UP',
  'CONFIRMED',
  'ARRANGEMENTS',
  'VOUCHER_SENT',
  'COMPLETED',
  'REJECTED',
] as const;
export type LeadStatus = (typeof LeadStatus)[number];

/** The active pipeline stages, in order (excludes the terminal REJECTED branch). */
export const LEAD_PIPELINE: LeadStatus[] = [
  'NEW',
  'QUOTE_SENT',
  'FOLLOW_UP',
  'CONFIRMED',
  'ARRANGEMENTS',
  'VOUCHER_SENT',
  'COMPLETED',
];

/** One hotel option quoted to the agency. */
export interface LeadHotelOption {
  name: string;
  starRating?: number;
  location?: string;
  roomType?: string;
  /** Internal quote currency for hotel costing. EasyGo lead costing is AED-native. */
  currency?: string;
  /** AED sell rate per room per night. */
  pricePerNight?: number;
  /** Rooms required/quoted for this option. */
  roomCount?: number;
  /** Max guests allowed in one room before another room is required. */
  maxOccupancy?: number;
  /** How many guests share one room: SINGLE=1/room, DOUBLE=2/room, TRIPLE=3/room */
  occupancyType?: 'SINGLE' | 'DOUBLE' | 'TRIPLE';
  /** Pax allocated to this specific room segment (for mixed-type packages). Defaults to total lead pax. */
  paxCount?: number;
  nights?: number;
  totalPrice?: number;
  pricePerPerson?: number;
  recommended?: boolean;
}

// ── Service catalog ───────────────────────────────────────────────────────────
export const ServiceCategoryCode = [
  'VISA',
  'TRANSFER',
  'ACTIVITY',
  'SIGHTSEEING',
  'MEAL',
  'ACCOMMODATION',
  'INSURANCE',
  'OTHER',
] as const;
export type ServiceCategoryCode = (typeof ServiceCategoryCode)[number];

export interface ServiceCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

/** A tenant-scoped catalog service (source of truth for what EasyGo sells). */
export interface Service {
  id: string;
  organizationId: string;
  categoryCode: string;
  name: string;
  code?: string;
  destination: string;
  serviceType?: string;
  /** Groups variants under a generic requirement label, e.g. "Airport Transfer". */
  variantGroup?: string;
  description?: string;
  supplier?: string;
  currency: string;
  basePrice?: number;
  costPrice?: number;
  defaultSellPrice?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A service attached to a lead — a point-in-time snapshot of a catalog service. */
export interface LeadServiceItem {
  serviceId?: string;
  serviceName: string;
  categoryCode?: string;
  /** The generic requirement group this variant fulfils, e.g. "Airport Transfer". */
  variantGroup?: string;
  supplier?: string;
  currency?: string;
  costPrice?: number;
  sellPrice?: number;
  /** Base price per booking unit — used with pricingType to compute sellPrice. */
  basePricePerUnit?: number;
  /** PRIVATE = full cost per person; SHARED = cost split by pax (with optional capacity). */
  pricingType?: 'PRIVATE' | 'SHARED';
  /** Max pax per unit for SHARED services (e.g. 4 for a shared van). */
  capacity?: number;
  snapshotDate?: string;
}

export const TravelerType = ['ADULT', 'CHILD', 'INFANT'] as const;
export type TravelerType = (typeof TravelerType)[number];

export const FlightType = ['OUTBOUND', 'INBOUND', 'INTERNAL'] as const;
export type FlightType = (typeof FlightType)[number];

export const FlightClass = ['ECONOMY', 'BUSINESS', 'FIRST'] as const;
export type FlightClass = (typeof FlightClass)[number];

export interface LeadHotel {
  hotelId?: string;
  hotelName: string;
  roomType?: string;
  mealPlan?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  roomCount?: number;
  rating?: number;
  pricePerNight?: number;
  totalPrice?: number;
  currency?: string;
  notes?: string;
}

export interface LeadLocation {
  locationId: string;
  city: string;
  country?: string;
  nights?: number;
  checkIn?: string;
  checkOut?: string;
  hotels: LeadHotel[];
}

export interface LeadFlight {
  flightId: string;
  type: FlightType;
  airline?: string;
  flightNo?: string;
  from?: string;
  to?: string;
  date?: string;
  departureTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  flightClass?: FlightClass;
  pricePerPerson?: number;
  totalPrice?: number;
  currency?: string;
  notes?: string;
}

export interface LeadTraveler {
  travelerId: string;
  type: TravelerType;
  firstName?: string;
  lastName?: string;
  nationality?: string;
  passportNo?: string;
  dob?: string;
  notes?: string;
}

export interface BrainConfig {
  section: string;
  label?: string;
  prompt: string;
  updatedAt?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  companyName?: string;
  source: LeadSource;
  inquiryType: InquiryType;
  status: LeadStatus;
  startDate?: string;
  endDate?: string;
  notes?: string;
  rawInquiry?: string;
  // Inquiry requirements (the working brief)
  requirementsNote?: string;
  requestedServices?: string[];
  requestedHotels?: string[];
  // Selected catalog services (snapshots)
  serviceItems?: LeadServiceItem[];
  // Travel information
  destination?: string;
  travelDate?: string;
  returnDate?: string;
  adults?: number;
  children?: number;
  rooms?: number;
  nights?: number;
  services?: string[];
  // Hotel options & pricing
  hotelOptions?: LeadHotelOption[];
  markup?: number;
  currency?: string;
  quoteValidityHours?: number;
  // Internal tracking
  preparedBy?: string;
  /** Saved WhatsApp quote text; regenerated via the Recreate button. */
  whatsappMessage?: string;
  locations: LeadLocation[];
  flights: LeadFlight[];
  travelers: LeadTraveler[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export const LeadActivityType = [
  'LEAD_CREATED',
  'LEAD_UPDATED',
  'STATUS_CHANGED',
  'NOTE_ADDED',
  'PROPOSAL_CREATED',
  'PROPOSAL_SENT',
  'PROPOSAL_VIEWED',
  'PROPOSAL_ACCEPTED',
  'PROPOSAL_REJECTED',
  'FOLLOW_UP_SCHEDULED',
  'FOLLOW_UP_COMPLETED',
  'FULFILLMENT_CREATED',
  'FULFILLMENT_UPDATED',
  'WHATSAPP_MESSAGE',
] as const;
export type LeadActivityType = (typeof LeadActivityType)[number];

export interface LeadActivity {
  id: string;
  leadId: string;
  type: LeadActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const ProposalType = ['VISA', 'TRAVEL_PACKAGE', 'HOTEL', 'CUSTOM'] as const;
export type ProposalType = (typeof ProposalType)[number];

export const ProposalStatus = [
  'DRAFT',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
] as const;
export type ProposalStatus = (typeof ProposalStatus)[number];

/** Operational (booking) lifecycle - Phase 2.1 / Phase 3. Runs alongside sales `status`. */
export const ProposalBookingStatus = [
  'NOT_READY',
  'READY_FOR_BOOKING',
  'BOOKED',
  'FULFILLING',
  'COMPLETED',
] as const;
export type ProposalBookingStatus = (typeof ProposalBookingStatus)[number];

export interface Proposal {
  id: string;
  leadId?: string | null;
  title: string;
  description?: string;
  proposalType: ProposalType;
  amount: number;
  currency: string;
  status: ProposalStatus;
  generatedToken: string;
  expiresAt?: string;
  notes?: string;
  // Commercial lineage + snapshot (Phase 2.1)
  inquiryId?: string | null;
  packageId?: string | null;
  quotationId?: string | null;
  quotationNumber?: string;
  quotationVersion?: number;
  commercialSnapshot?: PackageSnapshot | null;
  acceptedPrice?: number;
  acceptedDate?: string;
  bookingStatus?: ProposalBookingStatus;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export const FulfillmentType = ['VISA', 'TRAVEL_PACKAGE', 'HOTEL', 'TRANSFER', 'CUSTOM'] as const;
export type FulfillmentType = (typeof FulfillmentType)[number];

export const FulfillmentStatus = [
  'PENDING',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'COMPLETED',
  'CANCELLED',
] as const;
export type FulfillmentStatus = (typeof FulfillmentStatus)[number];

export interface Fulfillment {
  id: string;
  leadId: string;
  proposalId?: string;
  type: FulfillmentType;
  status: FulfillmentStatus;
  remarks?: string;
  dueDate?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export const FollowUpOutcome = [
  'NO_RESPONSE',
  'POSITIVE',
  'NEEDS_CHANGES',
  'REJECTED',
  'ACCEPTED',
] as const;
export type FollowUpOutcome = (typeof FollowUpOutcome)[number];

export interface FollowUp {
  id: string;
  leadId: string;
  scheduledDate: string;
  remarks?: string;
  outcome?: FollowUpOutcome;
  nextAction?: string;
  completedAt?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptProposalResult {
  proposal: Proposal;
  fulfillment: Fulfillment;
}

export interface Agency {
  id: string;
  organizationId: string;
  name: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  city?: string;
  country?: string;
  address?: string;
  website?: string;
  notes?: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedInquiry {
  customerName: string | null;
  /** Travel agency / company the enquiry comes from. */
  agencyName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  destination: string | null;
  service: string | null;
  /** Requested services as free-form labels (Visa, Airport Transfer, …). */
  services: string[];
  /** Hotels the client named in the inquiry. */
  requestedHotels: string[];
  /** AI-authored "CLIENT REQUIREMENTS" brief. */
  requirementsNote: string | null;
  travelers: number | null;
  adults: number | null;
  children: number | null;
  rooms: number | null;
  travelDate: string | null;
  returnDate: string | null;
  budget: number | null;
  /** 0–100 extraction confidence for the whole enquiry. */
  confidence: number;
  /** Human-readable labels of the important fields that could NOT be extracted. */
  missing: string[];
}
