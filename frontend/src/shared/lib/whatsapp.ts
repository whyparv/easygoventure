// Builds the EasyGo Venture WhatsApp quote from a Lead.
//
// The output must stay short enough to avoid WhatsApp's "Read More" fold:
// no marketing copy, no deposit text, no long descriptions. It always ends with
//   — Easy Go Venture Tourism (by {preparedBy})
// so the client can track who prepared / closed each quote.
import type { Lead, LeadHotelOption } from '@shared/types/domain';

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  AED: 'AED ',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
};

function money(amount: number, currency = 'USD'): string {
  const sym = CURRENCY_SYMBOL[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
  // Drop trailing .00 for whole numbers.
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${sym}${value}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "15 Jun–19 Jun", or a single date, or empty. */
function dateRange(travelDate?: string, returnDate?: string): string {
  const a = shortDate(travelDate);
  const b = shortDate(returnDate);
  if (a && b) return `${a}–${b}`;
  return a ?? b ?? '';
}

function stars(rating?: number): string {
  return rating ? ` (${rating}★)` : '';
}

function hotelBlock(option: LeadHotelOption, index: number, currency: string): string {
  const lines: string[] = [];
  lines.push(`*${index + 1}. ${option.name}*${stars(option.starRating)}${option.recommended ? ' ✅' : ''}`);
  if (option.location) lines.push(`📍 ${option.location}`);
  const priceLabel =
    option.pricePerPerson != null ? `${money(option.pricePerPerson, currency)}/person` : null;
  const room = [option.roomType, priceLabel].filter(Boolean).join(' | ');
  if (room) lines.push(room);
  return lines.join('\n');
}

export interface WhatsAppQuoteOptions {
  /** Falls back to lead.preparedBy, then to this, when signing the quote. */
  staffName?: string;
}

/**
 * Render the WhatsApp-ready quote for a lead. Pure — safe to unit test and to
 * call on every render for a live preview.
 */
export function buildWhatsAppQuote(lead: Lead, opts: WhatsAppQuoteOptions = {}): string {
  const currency = lead.currency ?? 'USD';
  const pax = (lead.adults ?? 0) + (lead.children ?? 0);
  const blocks: string[] = [];

  // Header — "*Dubai Package — 15 Jun–19 Jun | 2 pax*"
  const range = dateRange(lead.travelDate, lead.returnDate);
  const titleParts = [`${lead.destination ? `${lead.destination} ` : ''}Package`, range]
    .filter(Boolean)
    .join(' — ');
  const header = [titleParts, pax > 0 ? `${pax} pax` : ''].filter(Boolean).join(' | ');
  blocks.push(`*${header}*`);

  // Recipient — "For: Chukwudi Emmanuel (Travel Connect)"
  const forLine = `For: ${lead.name}${lead.companyName ? ` (${lead.companyName})` : ''}`;
  blocks.push(forLine);

  // Hotel options
  const hotels = lead.hotelOptions ?? [];
  if (hotels.length > 0) {
    blocks.push(hotels.map((h, i) => hotelBlock(h, i, currency)).join('\n\n'));
  }

  // Includes — nights + breakfast + selected services + taxes.
  // Prefer catalog service snapshots; fall back to legacy string services.
  const serviceNames =
    lead.serviceItems && lead.serviceItems.length > 0
      ? lead.serviceItems.map((s) => s.serviceName)
      : (lead.services ?? []);
  const includes = [
    lead.nights ? `${lead.nights} Nights accommodation` : null,
    'Daily Breakfast',
    ...serviceNames,
    'Taxes (excl. tourism dirham)',
  ].filter(Boolean);
  blocks.push(`*Includes:* ${includes.join(' · ')}`);

  // Validity + terms
  const validity = lead.quoteValidityHours ?? 48;
  blocks.push(`⚠️ ${validity} hours validity · Non refundable · Subject to availability`);

  blocks.push('To confirm: names + passports');

  // Signature — who prepared the quote
  const staff = lead.preparedBy || opts.staffName;
  blocks.push(`— Easy Go Venture Tourism${staff ? ` (by ${staff})` : ''}`);

  return blocks.join('\n\n');
}

/** wa.me deep link that opens the message in WhatsApp for a given phone. */
export function whatsappDeepLink(phone: string | undefined, message: string): string {
  const digits = (phone ?? '').replace(/[^\d]/g, '');
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
