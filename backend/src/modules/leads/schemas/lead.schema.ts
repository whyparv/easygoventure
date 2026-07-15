import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/database/schema-options';

export enum LeadSource {
  WHATSAPP = 'WHATSAPP',
  MANUAL = 'MANUAL',
  EMAIL = 'EMAIL',
}

export enum InquiryType {
  VISA = 'VISA',
  TRAVEL_PACKAGE = 'TRAVEL_PACKAGE',
  HOTEL = 'HOTEL',
  TRANSFER = 'TRANSFER',
  CUSTOM = 'CUSTOM',
}

/**
 * The EasyGo Venture travel-inquiry pipeline. Every record is a Lead that moves
 * through these stages; the old Inquiry / Proposal / Follow-up modules collapse
 * into these statuses rather than being separate concepts.
 *
 *   NEW → QUOTE_SENT → FOLLOW_UP → CONFIRMED → ARRANGEMENTS → VOUCHER_SENT → COMPLETED
 *
 * REJECTED is the terminal "closed / lost" branch.
 */
export enum LeadStatus {
  NEW = 'NEW',
  QUOTE_SENT = 'QUOTE_SENT',
  FOLLOW_UP = 'FOLLOW_UP',
  CONFIRMED = 'CONFIRMED',
  ARRANGEMENTS = 'ARRANGEMENTS',
  VOUCHER_SENT = 'VOUCHER_SENT',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

/**
 * One hotel option quoted to the agency. `recommended` marks the option EasyGo
 * highlights (the ✅ line in the WhatsApp quote).
 */
@Schema({ _id: false })
export class LeadHotelOption {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Number, min: 0, max: 7 })
  starRating?: number;

  @Prop({ trim: true })
  location?: string;

  @Prop({ trim: true })
  roomType?: string;

  /** Selling price per person for this option, in the lead's currency. */
  @Prop({ type: Number, min: 0 })
  pricePerPerson?: number;

  @Prop({ type: Boolean, default: false })
  recommended?: boolean;
}

export const LeadHotelOptionSchema = SchemaFactory.createForClass(LeadHotelOption);

/**
 * A service attached to a lead — a point-in-time SNAPSHOT of a catalog service.
 * The service's own price can change later; the lead keeps what was quoted so
 * historical quotes never mutate. `serviceId` links back to the catalog (may be
 * null for a free-form/custom service added manually).
 */
@Schema({ _id: false })
export class LeadServiceItem {
  /** Back-reference to the catalog Service id (string; null for a custom service). */
  @Prop({ trim: true })
  serviceId?: string;

  @Prop({ required: true, trim: true })
  serviceName!: string;

  @Prop({ trim: true, uppercase: true })
  categoryCode?: string;

  /** The generic requirement group this variant fulfils, e.g. "Airport Transfer". */
  @Prop({ trim: true })
  variantGroup?: string;

  @Prop({ trim: true })
  supplier?: string;

  @Prop({ type: String, trim: true, uppercase: true, default: 'USD' })
  currency?: string;

  @Prop({ type: Number, min: 0 })
  costPrice?: number;

  @Prop({ type: Number, min: 0 })
  sellPrice?: number;

  /** Base price per booking unit — used with pricingType to compute sellPrice. */
  @Prop({ type: Number, min: 0 })
  basePricePerUnit?: number;

  /** PRIVATE = full cost per person; SHARED = cost split by pax (with optional capacity). */
  @Prop({ type: String, enum: ['PRIVATE', 'SHARED'], default: 'PRIVATE' })
  pricingType?: string;

  /** Max pax per unit for SHARED services (e.g. 4 for a shared van). */
  @Prop({ type: Number, min: 1 })
  capacity?: number;

  @Prop({ type: Date, default: () => new Date() })
  snapshotDate?: Date;
}

export const LeadServiceItemSchema = SchemaFactory.createForClass(LeadServiceItem);

export enum TravelerType {
  ADULT = 'ADULT',
  CHILD = 'CHILD',
  INFANT = 'INFANT',
}

export enum FlightType {
  OUTBOUND = 'OUTBOUND',
  INBOUND = 'INBOUND',
  INTERNAL = 'INTERNAL',
}

export enum FlightClass {
  ECONOMY = 'ECONOMY',
  BUSINESS = 'BUSINESS',
  FIRST = 'FIRST',
}

export class LeadHotel {
  @Prop({ trim: true })
  hotelId?: string;

  @Prop({ required: true, trim: true })
  hotelName!: string;

  @Prop({ trim: true })
  roomType?: string;

  @Prop({ trim: true })
  mealPlan?: string;

  /** Check-in date for this hotel stay (YYYY-MM-DD). */
  @Prop({ trim: true })
  checkIn?: string;

  /** Check-out date for this hotel stay (YYYY-MM-DD). */
  @Prop({ trim: true })
  checkOut?: string;

  @Prop({ type: Number })
  nights?: number;

  @Prop({ type: Number })
  roomCount?: number;

  @Prop({ type: Number })
  rating?: number;

  /** Price per room per night. */
  @Prop({ type: Number })
  pricePerNight?: number;

  /** Total hotel cost = pricePerNight × nights × roomCount. */
  @Prop({ type: Number })
  totalPrice?: number;

  @Prop({ trim: true, default: 'USD' })
  currency?: string;

  @Prop({ trim: true })
  notes?: string;
}

export class LeadLocation {
  /** Client-generated UUID so the frontend can key list items. */
  @Prop({ required: true, trim: true })
  locationId!: string;

  @Prop({ required: true, trim: true })
  city!: string;

  @Prop({ trim: true })
  country?: string;

  @Prop({ type: Number })
  nights?: number;

  @Prop({ trim: true })
  checkIn?: string;

  @Prop({ trim: true })
  checkOut?: string;

  @Prop({ type: [Object], default: [] })
  hotels!: LeadHotel[];
}

export class LeadFlight {
  /** Client-generated UUID. */
  @Prop({ required: true, trim: true })
  flightId!: string;

  @Prop({ type: String, enum: FlightType, default: FlightType.OUTBOUND })
  type!: FlightType;

  @Prop({ trim: true })
  airline?: string;

  @Prop({ trim: true })
  flightNo?: string;

  /** Departure airport/city (e.g. "DXB", "Dubai International"). */
  @Prop({ trim: true })
  from?: string;

  /** Arrival airport/city. */
  @Prop({ trim: true })
  to?: string;

  /** Departure date YYYY-MM-DD. */
  @Prop({ trim: true })
  date?: string;

  /** Departure time HH:MM. */
  @Prop({ trim: true })
  departureTime?: string;

  /** Arrival date YYYY-MM-DD (may differ from departure for overnight flights). */
  @Prop({ trim: true })
  arrivalDate?: string;

  /** Arrival time HH:MM. */
  @Prop({ trim: true })
  arrivalTime?: string;

  @Prop({ type: String, enum: FlightClass, default: FlightClass.ECONOMY })
  flightClass?: FlightClass;

  /** Price per person. */
  @Prop({ type: Number })
  pricePerPerson?: number;

  /** Total flight cost. */
  @Prop({ type: Number })
  totalPrice?: number;

  @Prop({ trim: true, default: 'USD' })
  currency?: string;

  @Prop({ trim: true })
  notes?: string;
}

export class LeadTraveler {
  @Prop({ required: true, trim: true })
  travelerId!: string;

  @Prop({ type: String, enum: TravelerType, default: TravelerType.ADULT })
  type!: TravelerType;

  @Prop({ trim: true })
  firstName?: string;

  @Prop({ trim: true })
  lastName?: string;

  @Prop({ trim: true })
  nationality?: string;

  @Prop({ trim: true })
  passportNo?: string;

  @Prop({ type: Date })
  dob?: Date;

  @Prop({ trim: true })
  notes?: string;
}

export type LeadDocument = HydratedDocument<Lead>;

@Schema({ ...baseSchemaOptions, collection: 'leads' })
export class Lead {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, index: true })
  organizationId!: Types.ObjectId;

  // Optional — a lead can be captured from a partial inquiry and enriched later.
  @Prop({ trim: true, default: '' })
  name!: string;

  @Prop({ trim: true, default: '' })
  phone!: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  companyName?: string;

  @Prop({ type: String, enum: LeadSource, default: LeadSource.WHATSAPP })
  source!: LeadSource;

  @Prop({ type: String, enum: InquiryType, default: InquiryType.TRAVEL_PACKAGE })
  inquiryType!: InquiryType;

  @Prop({ type: String, enum: LeadStatus, default: LeadStatus.NEW, index: true })
  status!: LeadStatus;

  /** Overall trip start date (YYYY-MM-DD). */
  @Prop({ trim: true })
  startDate?: string;

  /** Overall trip end date (YYYY-MM-DD). */
  @Prop({ trim: true })
  endDate?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ trim: true })
  rawInquiry?: string;

  // ── Inquiry requirements (the working brief) ───────────────────────────────
  /**
   * AI-interpreted "CLIENT REQUIREMENTS" brief generated when the inquiry is
   * parsed. Preserves the original operational intent so staff always know what
   * the client actually asked for, independent of what ends up selected/quoted.
   */
  @Prop({ trim: true })
  requirementsNote?: string;

  /** Services the client requested (from the inquiry) — drives smart suggestions. */
  @Prop({ type: [String], default: [] })
  requestedServices!: string[];

  /** Hotels the client named in the inquiry — drives smart suggestions. */
  @Prop({ type: [String], default: [] })
  requestedHotels!: string[];

  // ── Travel information ─────────────────────────────────────────────────────
  @Prop({ trim: true })
  destination?: string;

  @Prop({ type: Date })
  travelDate?: Date;

  @Prop({ type: Date })
  returnDate?: Date;

  @Prop({ type: Number, min: 0, default: 0 })
  adults?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  children?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  rooms?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  nights?: number;

  /**
   * Legacy selected services as free-form labels. Retained for back-compat and as
   * a fallback for leads created before the catalog. New selections live in
   * `serviceItems` (catalog snapshots); this stays in sync with their names.
   */
  @Prop({ type: [String], default: [] })
  services!: string[];

  /** Catalog services attached to this lead, as point-in-time snapshots. */
  @Prop({ type: [LeadServiceItemSchema], default: [] })
  serviceItems!: LeadServiceItem[];

  // ── Hotel options & pricing ────────────────────────────────────────────────
  @Prop({ type: [LeadHotelOptionSchema], default: [] })
  hotelOptions!: LeadHotelOption[];

  /** Markup applied over vendor cost, in the lead's currency (informational). */
  @Prop({ type: Number, min: 0 })
  markup?: number;

  @Prop({ type: String, default: 'USD', trim: true, uppercase: true })
  currency!: string;

  /** Hours the quote stays valid — rendered as the ⚠️ validity line. */
  @Prop({ type: Number, min: 0, default: 48 })
  quoteValidityHours?: number;

  // ── Internal tracking ──────────────────────────────────────────────────────
  /**
   * EasyGo Venture staff member who handled the lead / prepared the quote.
   * Surfaces in reports (who closes most business) and signs the WhatsApp quote
   * as "— Easy Go Venture Tourism (by {preparedBy})".
   */
  @Prop({ trim: true })
  preparedBy?: string;

  /** Multi-location itinerary, each location has its own hotel list. */
  @Prop({ type: [Object], default: [] })
  locations!: LeadLocation[];

  /** Flight details - outbound, inbound, internal connections. */
  @Prop({ type: [Object], default: [] })
  flights!: LeadFlight[];

  /** Traveler roster for this lead. */
  @Prop({ type: [Object], default: [] })
  travelers!: LeadTraveler[];

  @Prop({ type: Boolean, default: false, index: true })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

LeadSchema.index({ organizationId: 1, status: 1 });
LeadSchema.index({ organizationId: 1, createdAt: -1 });
