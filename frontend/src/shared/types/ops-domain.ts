// Phase 2 / 2.1 / 3 domain types — commercial engine + operations engine.
// Mirrors the NestJS/Mongoose backend response shapes (ids + ISO date strings).

// ── Service lines ────────────────────────────────────────────────────────────
export const ServiceLineType = ['HOTEL', 'ACTIVITY', 'TRANSFER', 'VISA', 'FLIGHT', 'CUSTOM'] as const;
export type ServiceLineType = (typeof ServiceLineType)[number];

export const MarkupType = ['PERCENTAGE', 'FIXED'] as const;
export type MarkupType = (typeof MarkupType)[number];

// ── Hotel catalog ────────────────────────────────────────────────────────────
export interface Hotel {
  id: string;
  name: string;
  category: string;
  starRating: number;
  area?: string;
  city: string;
  country: string;
  isActive: boolean;
  /** Present only when served from the JSON fallback (database unavailable). */
  source?: 'file';
}

// ── Inquiry ──────────────────────────────────────────────────────────────────
export const InquirySource = ['WHATSAPP', 'MANUAL', 'EMAIL', 'PHONE', 'WEBSITE', 'REFERRAL'] as const;
export type InquirySource = (typeof InquirySource)[number];

export const InquiryStatus = [
  'DRAFT',
  'COLLECTING_INFORMATION',
  'READY_FOR_PRICING',
  'QUOTED',
  'CONVERTED',
  'CANCELLED',
] as const;
export type InquiryStatus = (typeof InquiryStatus)[number];

export interface Inquiry {
  id: string;
  referenceNo: string;
  source: InquirySource;
  status: InquiryStatus;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  companyName?: string;
  destination?: string;
  serviceCategoryCode?: string;
  travelers?: number;
  travelDate?: string;
  budget?: number;
  rawInquiry?: string;
  notes?: string;
  convertedLeadId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Package + items ──────────────────────────────────────────────────────────
export const PackageStatus = ['DRAFT', 'COSTED', 'QUOTED', 'ARCHIVED'] as const;
export type PackageStatus = (typeof PackageStatus)[number];

export interface Package {
  id: string;
  inquiryId?: string | null;
  name: string;
  destination?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  numberOfTravelers: number;
  currency: string;
  status: PackageStatus;
  totalCost: number;
  totalMarkup: number;
  totalSellPrice: number;
  expectedProfit: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackageItem {
  id: string;
  packageId: string;
  type: ServiceLineType;
  vendorRateId?: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  markupType: MarkupType;
  markupValue: number;
  unitSellPrice: number;
  totalCost: number;
  totalSellPrice: number;
  profit: number;
  createdAt: string;
  updatedAt: string;
}

// ── Immutable commercial snapshot (embedded on Quotation + Proposal) ─────────
export interface VendorRateSnapshot {
  vendorRateId?: string;
  vendorId?: string;
  vendorName?: string;
  rateType?: string;
  currency?: string;
  netCost?: number;
}

export interface PackageItemSnapshot {
  itemId: string;
  type: string;
  description: string;
  quantity: number;
  unitCost: number;
  unitSellPrice: number;
  markupType: string;
  markupValue: number;
  totalCost: number;
  totalSellPrice: number;
  profit: number;
  vendorRate?: VendorRateSnapshot | null;
}

export interface PackageSnapshot {
  packageId: string;
  name: string;
  destination?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  numberOfTravelers: number;
  currency: string;
  totalCost: number;
  totalMarkup: number;
  totalSellPrice: number;
  expectedProfit: number;
  items: PackageItemSnapshot[];
}

// ── Quotation ────────────────────────────────────────────────────────────────
export const QuotationStatus = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;
export type QuotationStatus = (typeof QuotationStatus)[number];

export interface Quotation {
  id: string;
  packageId: string;
  quotationNumber: string;
  version: number;
  currency: string;
  customerPrice: number;
  validUntil?: string;
  notes?: string;
  status: QuotationStatus;
  snapshot: PackageSnapshot;
  sentAt?: string;
  acceptedAt?: string;
  convertedProposalId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Travelers ────────────────────────────────────────────────────────────────
export const TravelerStatus = ['ACTIVE', 'CANCELLED'] as const;
export type TravelerStatus = (typeof TravelerStatus)[number];

export const TravelerGender = ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'] as const;
export type TravelerGender = (typeof TravelerGender)[number];

export interface Traveler {
  id: string;
  organizationId: string;
  proposalId: string;
  firstName: string;
  lastName: string;
  gender: TravelerGender;
  dateOfBirth?: string;
  nationality?: string;
  passportNumber?: string;
  passportExpiry?: string;
  email?: string;
  phone?: string;
  notes?: string;
  status: TravelerStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Bookings ─────────────────────────────────────────────────────────────────
export const BookingType = ['HOTEL', 'ACTIVITY', 'TRANSFER', 'VISA', 'FLIGHT'] as const;
export type BookingType = (typeof BookingType)[number];

export const BookingStatus = ['PENDING', 'REQUESTED', 'CONFIRMED', 'FAILED', 'CANCELLED'] as const;
export type BookingStatus = (typeof BookingStatus)[number];

export interface HotelBookingDetails {
  hotelName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomCount?: number;
  roomType?: string;
  confirmationNumber?: string;
  specialRequests?: string;
  status?: string;
}

export interface TransferBookingDetails {
  pickupLocation?: string;
  dropLocation?: string;
  pickupTime?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  status?: string;
}

export interface VisaProcessing {
  passportReceivedAt?: string;
  applicationSubmittedAt?: string;
  processingStartedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  documents?: string[];
  notes?: string;
  status?: string;
}

export interface Booking {
  id: string;
  organizationId: string;
  proposalId: string;
  fulfillmentItemId?: string | null;
  vendorId?: string | null;
  bookingType: BookingType;
  bookingReference?: string;
  supplierReference?: string;
  confirmationDate?: string;
  travelDate?: string;
  notes?: string;
  status: BookingStatus;
  hotelDetails?: HotelBookingDetails | null;
  transferDetails?: TransferBookingDetails | null;
  visaProcessing?: VisaProcessing | null;
  createdAt: string;
  updatedAt: string;
}

// ── Timeline ─────────────────────────────────────────────────────────────────
export interface TimelineEvent {
  date: string | null;
  type: string;
  category: string;
  title: string;
  detail?: string;
  status: string;
  bookingId: string;
}

export interface TripTimeline {
  proposalId: string;
  generatedAt: string;
  travelerCount: number;
  eventCount: number;
  start: string | null;
  end: string | null;
  events: TimelineEvent[];
}

// ── Risk ─────────────────────────────────────────────────────────────────────
export const RiskLevel = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type RiskLevel = (typeof RiskLevel)[number];

export interface RiskIssue {
  code: string;
  level: RiskLevel;
  message: string;
  count?: number;
}

export interface ProposalRisk {
  proposalId: string;
  level: RiskLevel;
  departureDate: string | null;
  hoursToDeparture: number | null;
  issues: RiskIssue[];
  assessedAt: string;
}

// ── Operations dashboard ─────────────────────────────────────────────────────
export interface OperationsDashboard {
  generatedAt: string;
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

// ── Documents ────────────────────────────────────────────────────────────────
export const DocumentType = [
  'TRAVEL_VOUCHER',
  'FINAL_ITINERARY',
  'TRAVELER_MANIFEST',
  'BOOKING_SUMMARY',
  'OPERATIONAL_BRIEF',
] as const;
export type DocumentType = (typeof DocumentType)[number];

export interface GeneratedDocument {
  id: string;
  proposalId: string;
  type: DocumentType;
  title: string;
  format: string;
  checksum?: string;
  storageRef?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentGenerationResult {
  document: GeneratedDocument;
  content: Record<string, unknown>;
}

// ── Hotel recommendations (image-ready cards + budget tiers) ─────────────────
export const BudgetTier = ['Budget', 'Mid-range', 'Premium', 'Luxury'] as const;
export type BudgetTier = (typeof BudgetTier)[number];

export interface HotelCard {
  id: string;
  name: string;
  rating: number;
  location: string;
  tier: BudgetTier;
  highlights: string[];
  /** Present but empty today — architecture is ready for hotel imagery. */
  imageUrls: string[];
}

export interface HotelRecommendations {
  destination: string | null;
  travelers: number;
  nights: number;
  budget: number | null;
  suggestedTier: BudgetTier | null;
  perNightBudget: number | null;
  tiers: Array<{ tier: BudgetTier; hotels: HotelCard[] }>;
}

export interface ProposalDraft {
  proposal: string;
  recommendations: HotelRecommendations;
}

// ── Revenue pipeline ─────────────────────────────────────────────────────────
export interface RevenuePipeline {
  inquiries: number;
  packages: number;
  proposals: number;
  quotations: { total: number; sent: number; accepted: number; rejected: number };
  conversionRate: number;
  expectedRevenue: number;
  expectedProfit: number;
  pipelineRevenue: number;
  fulfillment: Record<string, number>;
  proposalsByBookingStatus: Record<string, number>;
}
