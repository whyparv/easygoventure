export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'primary' | 'sage' | 'pink';

const LEAD_TONE: Record<string, Tone> = {
  NEW: 'pink',
  QUOTE_SENT: 'primary',
  FOLLOW_UP: 'warning',
  CONFIRMED: 'success',
  ARRANGEMENTS: 'info',
  VOUCHER_SENT: 'sage',
  COMPLETED: 'success',
  REJECTED: 'danger',
};

const PROPOSAL_TONE: Record<string, Tone> = {
  DRAFT: 'neutral',
  SENT: 'info',
  VIEWED: 'primary',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
};

const FULFILLMENT_TONE: Record<string, Tone> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'info',
  WAITING_CUSTOMER: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const OUTCOME_TONE: Record<string, Tone> = {
  NO_RESPONSE: 'neutral',
  POSITIVE: 'success',
  NEEDS_CHANGES: 'warning',
  REJECTED: 'danger',
  ACCEPTED: 'success',
};

const BOOKING_TONE: Record<string, Tone> = {
  PENDING: 'neutral',
  REQUESTED: 'info',
  CONFIRMED: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
};

const QUOTATION_TONE: Record<string, Tone> = {
  DRAFT: 'neutral',
  SENT: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'warning',
};

const INQUIRY_TONE: Record<string, Tone> = {
  DRAFT: 'neutral',
  COLLECTING_INFORMATION: 'sage',
  READY_FOR_PRICING: 'sage',
  QUOTED: 'warning',
  CONVERTED: 'success',
  CANCELLED: 'danger',
};

const BOOKING_LIFECYCLE_TONE: Record<string, Tone> = {
  NOT_READY: 'neutral',
  READY_FOR_BOOKING: 'info',
  BOOKED: 'success',
  FULFILLING: 'warning',
  COMPLETED: 'success',
};

const RISK_TONE: Record<string, Tone> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

const PACKAGE_TONE: Record<string, Tone> = {
  DRAFT: 'neutral',
  COSTED: 'info',
  QUOTED: 'primary',
  ARCHIVED: 'neutral',
};

export function bookingTone(status: string): Tone {
  return BOOKING_TONE[status] ?? 'neutral';
}
export function quotationTone(status: string): Tone {
  return QUOTATION_TONE[status] ?? 'neutral';
}
export function inquiryTone(status: string): Tone {
  return INQUIRY_TONE[status] ?? 'neutral';
}
export function bookingLifecycleTone(status: string): Tone {
  return BOOKING_LIFECYCLE_TONE[status] ?? 'neutral';
}
export function riskTone(level: string): Tone {
  return RISK_TONE[level] ?? 'neutral';
}
export function packageTone(status: string): Tone {
  return PACKAGE_TONE[status] ?? 'neutral';
}

export function leadTone(status: string): Tone {
  return LEAD_TONE[status] ?? 'neutral';
}
export function proposalTone(status: string): Tone {
  return PROPOSAL_TONE[status] ?? 'neutral';
}
export function fulfillmentTone(status: string): Tone {
  return FULFILLMENT_TONE[status] ?? 'neutral';
}
export function outcomeTone(outcome: string): Tone {
  return OUTCOME_TONE[outcome] ?? 'neutral';
}
