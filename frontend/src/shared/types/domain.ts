// Domain enums + entity types mirroring the NestJS/Mongoose backend.
import type { PackageSnapshot } from '@shared/types/ops-domain';

export const LeadSource = ['WHATSAPP', 'MANUAL', 'EMAIL'] as const;
export type LeadSource = (typeof LeadSource)[number];

export const InquiryType = ['VISA', 'TRAVEL_PACKAGE', 'HOTEL', 'TRANSFER', 'CUSTOM'] as const;
export type InquiryType = (typeof InquiryType)[number];

export const LeadStatus = [
  'NEW',
  'PROPOSAL_SENT',
  'AWAITING_RESPONSE',
  'FOLLOW_UP',
  'ACCEPTED',
  'REJECTED',
  'COMPLETED',
] as const;
export type LeadStatus = (typeof LeadStatus)[number];

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  companyName?: string;
  source: LeadSource;
  inquiryType: InquiryType;
  status: LeadStatus;
  notes?: string;
  rawInquiry?: string;
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

/** Operational (booking) lifecycle — Phase 2.1 / Phase 3. Runs alongside sales `status`. */
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

export interface ParsedInquiry {
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  destination: string | null;
  service: string | null;
  travelers: number | null;
  travelDate: string | null;
  budget: number | null;
  /** 0–100 extraction confidence for the whole enquiry. */
  confidence: number;
  /** Human-readable labels of the important fields that could NOT be extracted. */
  missing: string[];
}
