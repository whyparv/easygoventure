// Builds the EasyGo Venture WhatsApp quote from a Lead.
//
// The output must stay short enough to avoid WhatsApp's "Read More" fold:
// no marketing copy, no deposit text, no long descriptions. It always ends with
//   — Easy Go Venture Tourism (by {preparedBy})
// so the client can track who prepared / closed each quote.
import type { Lead, LeadHotelOption, LeadServiceItem } from '@shared/types/domain';

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  AED: 'AED ',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
};

function money(amount: number, currency = 'USD'): string {
  const sym = CURRENCY_SYMBOL[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
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

function serviceAddOnLine(svc: LeadServiceItem, fallbackCurrency: string): string {
  const cur = svc.currency ?? fallbackCurrency;
  return `🔸 ${svc.serviceName} — ${money(svc.sellPrice!, cur)}/pax`;
}

export interface WhatsAppQuoteOptions {
  staffName?: string;
}

export function buildWhatsAppQuote(lead: Lead, opts: WhatsAppQuoteOptions = {}): string {
  const currency = lead.currency ?? 'USD';
  const pax = (lead.adults ?? 0) + (lead.children ?? 0);
  const blocks: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────────────
  const range = dateRange(lead.travelDate, lead.returnDate);
  const titleParts = [`${lead.destination ? `${lead.destination} ` : ''}Package`, range]
    .filter(Boolean)
    .join(' — ');
  const header = [titleParts, pax > 0 ? `${pax} pax` : ''].filter(Boolean).join(' | ');
  blocks.push(`*${header}*`);

  // ── Recipient ──────────────────────────────────────────────────────────────
  blocks.push(`For: ${lead.name}${lead.companyName ? ` (${lead.companyName})` : ''}`);

  // ── Hotel options ──────────────────────────────────────────────────────────
  const hotels = lead.hotelOptions ?? [];
  if (hotels.length > 0) {
    blocks.push(hotels.map((h, i) => hotelBlock(h, i, currency)).join('\n\n'));
  }

  // ── Priced services (shown as add-ons with per-person cost) ─────────────────
  const serviceItems = lead.serviceItems ?? [];
  const pricedAddOns = serviceItems.filter((s) => s.sellPrice != null && s.sellPrice > 0);
  if (pricedAddOns.length > 0) {
    const lines = pricedAddOns.map((s) => serviceAddOnLine(s, currency));
    blocks.push(`*Add-ons per person:*\n${lines.join('\n')}`);
  }

  // ── Includes list ──────────────────────────────────────────────────────────
  const serviceNames =
    serviceItems.length > 0
      ? serviceItems.map((s) => s.serviceName)
      : (lead.services ?? []);
  const includes = [
    lead.nights ? `${lead.nights} Nights accommodation` : null,
    'Daily Breakfast',
    ...serviceNames,
    'Taxes (excl. tourism dirham)',
  ].filter(Boolean);
  blocks.push(`*Includes:* ${includes.join(' · ')}`);

  // ── Package total (recommended hotel + same-currency services) ─────────────
  const recommended = hotels.find((h) => h.recommended) ?? hotels[0];
  if (recommended?.pricePerPerson != null) {
    const sameCurrencyServiceTotal = pricedAddOns
      .filter((s) => (s.currency ?? currency).toUpperCase() === currency.toUpperCase())
      .reduce((sum, s) => sum + (s.sellPrice ?? 0), 0);
    const total = recommended.pricePerPerson + sameCurrencyServiceTotal;
    const hasExtra = pricedAddOns.some(
      (s) => (s.currency ?? currency).toUpperCase() !== currency.toUpperCase(),
    );
    blocks.push(
      `💰 *Package from ${money(total, currency)}/person*${hasExtra ? ' + cross-currency services' : ''}`,
    );
  }

  // ── Validity + terms ───────────────────────────────────────────────────────
  const validity = lead.quoteValidityHours ?? 48;
  blocks.push(`⚠️ ${validity} hours validity · Non refundable · Subject to availability`);

  blocks.push('To confirm: names + passports');

  // ── Signature ──────────────────────────────────────────────────────────────
  const staff = lead.preparedBy || opts.staffName;
  blocks.push(`— Easy Go Venture Tourism${staff ? ` (by ${staff})` : ''}`);

  return blocks.join('\n\n');
}

export function whatsappDeepLink(phone: string | undefined, message: string): string {
  const digits = (phone ?? '').replace(/[^\d]/g, '');
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
