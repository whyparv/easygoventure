import type { InquiryType } from '@shared/types/domain';

/** Map an AI-extracted service label to the lead's coarse inquiry type. */
export function serviceToInquiryType(service?: string | null): InquiryType {
  const s = (service ?? '').toLowerCase();
  if (s.includes('visa')) return 'VISA';
  if (s.includes('hotel')) return 'HOTEL';
  if (s.includes('transfer')) return 'TRANSFER';
  if (s.includes('package') || s.includes('tour') || s.includes('trip')) return 'TRAVEL_PACKAGE';
  return 'CUSTOM';
}
