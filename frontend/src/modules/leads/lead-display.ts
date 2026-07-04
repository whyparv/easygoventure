import type { Lead } from '@shared/types/domain';

/**
 * A human label for a lead. Names are optional now (a lead can be captured from a
 * partial inquiry), so fall back to the agency, then the destination, then a
 * generic placeholder — never an empty string.
 */
export function leadDisplayName(
  lead: Pick<Lead, 'name' | 'companyName' | 'destination'>,
): string {
  return (
    lead.name?.trim() ||
    lead.companyName?.trim() ||
    (lead.destination?.trim() ? `${lead.destination.trim()} inquiry` : '') ||
    'Untitled lead'
  );
}
