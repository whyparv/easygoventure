// Builds the EasyGo Venture WhatsApp quote from a Lead.
//
// Layout (multi-city example):
//
//   *Dubai, Doha Package | 2 pax | 10–17 Aug*
//   For: Parv Jain (D&D Travels)
//
//   📍 DUBAI — 3 nights
//   *1. Address Beach Resort* (5★) ✅
//   • Deluxe Room — 1 room | max 2/room | $474/person
//   • Twin Room — 1 room | max 2/room | $474/person
//
//   📍 DOHA — 4 nights
//   *2. [5★ Hotel TBD]*
//
//   *Add-ons per person:*
//   🔸 VIP Airport Transfer — $48/pax
//   🔸 UAE Tourist Visa — $95/pax
//
//   *Includes:* VIP Airport Transfer · UAE Tourist Visa
//   💰 *Package from $617/person*
//   ⚠️ 48 hours validity · Non-refundable · Subject to availability
//   To confirm: names + passports
//   — Easy Go Venture Tourism (by sachin)

import type { Lead, LeadHotelOption } from '@shared/types/domain';
import { CUSTOMER_CURRENCY, INTERNAL_CURRENCY, blendedHotelCostPerPax, normalizeHotelOption, toCustomerUsd } from './lead-pricing';

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$', AED: 'AED ', EUR: '€', GBP: '£', NGN: '₦',
};

function money(amount: number, currency = 'USD'): string {
  const sym = CURRENCY_SYMBOL[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
  // Round to whole dollars for cleanliness; show cents only when < $10
  const rounded = amount >= 10 ? Math.round(amount) : Math.round(amount * 100) / 100;
  const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${sym}${value}`;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

// ── Hotel grouping ────────────────────────────────────────────────────────────

interface HotelGroup {
  name: string;
  starRating?: number;
  location?: string;
  recommended?: boolean;
  /** Options sorted: named room types first, unnamed last */
  options: LeadHotelOption[];
}

interface CitySection {
  city: string;
  nights?: number;
  groups: HotelGroup[];
  /** True if no hotel options are assigned to this city */
  isEmpty: boolean;
  /** Star rating hint when isEmpty (from destination info) */
  hintRating?: number;
}

function hotelGroupKey(opt: LeadHotelOption): string {
  return `${opt.name ?? ''}|${opt.location ?? ''}|${opt.starRating ?? ''}`.toLowerCase();
}

/** Build HotelGroups from options, filtering blank roomType entries when siblings
 *  with real room types exist at the same hotel. */
function buildHotelGroups(options: LeadHotelOption[]): HotelGroup[] {
  const groupMap = new Map<string, HotelGroup>();

  for (const opt of options) {
    const key = hotelGroupKey(opt);
    const g = groupMap.get(key);
    if (g) {
      g.recommended = g.recommended || opt.recommended;
      g.options.push(opt);
    } else {
      groupMap.set(key, {
        name: opt.name,
        starRating: opt.starRating,
        location: opt.location,
        recommended: opt.recommended,
        options: [opt],
      });
    }
  }

  // Filter blank roomType entries when typed siblings exist
  for (const g of groupMap.values()) {
    const hasTyped = g.options.some((o) => o.roomType?.trim());
    if (hasTyped) {
      g.options = g.options.filter((o) => o.roomType?.trim());
    }
    // Sort: named room types first, then by pricePerPerson ascending
    g.options.sort((a, b) => {
      const aHasType = a.roomType?.trim() ? 0 : 1;
      const bHasType = b.roomType?.trim() ? 0 : 1;
      if (aHasType !== bHasType) return aHasType - bHasType;
      return (a.pricePerPerson ?? 0) - (b.pricePerPerson ?? 0);
    });
  }

  return [...groupMap.values()];
}

/** Partition hotel groups into city sections, in the order cities first appear. */
function buildCitySections(
  allGroups: HotelGroup[],
  lead: Lead,
): CitySection[] {
  // Determine city order from locations[] (AI-populated destinations)
  const locationOrder: string[] = (lead.locations ?? []).map((l) => l.city);

  // Also collect cities from hotel options that aren't in locations
  allGroups.forEach((g) => {
    const city = g.location ?? '';
    if (city && !locationOrder.some((c) => c.toLowerCase() === city.toLowerCase())) {
      locationOrder.push(city);
    }
  });

  const sectionMap = new Map<string, CitySection>();

  for (const city of locationOrder) {
    const key = city.toLowerCase();
    if (!sectionMap.has(key)) {
      const nights = lead.locations?.find((l) => l.city.toLowerCase() === key)?.nights;
      const cityGroups = allGroups.filter(
        (g) => (g.location ?? '').toLowerCase() === key,
      );
      sectionMap.set(key, {
        city,
        nights,
        groups: cityGroups,
        isEmpty: cityGroups.length === 0,
      });
    }
  }

  // Hotels without a city assignment go into the first section
  const ungrouped = allGroups.filter((g) => !g.location);
  if (ungrouped.length > 0) {
    const firstKey = [...sectionMap.keys()][0];
    if (firstKey) {
      const s = sectionMap.get(firstKey)!;
      s.groups = [...s.groups, ...ungrouped];
      s.isEmpty = s.groups.length === 0;
    }
  }

  return [...sectionMap.values()];
}

// ── Hotel rendering ───────────────────────────────────────────────────────────

function renderGroup(group: HotelGroup, index: number, pax: number): string {
  const lines: string[] = [];
  const checkmark = group.recommended ? ' ✅' : '';
  lines.push(`*${index + 1}. ${group.name}*${stars(group.starRating)}${checkmark}`);

  for (const opt of group.options) {
    const label = opt.roomType?.trim() || 'Room';
    const meal = mealPlanFromRoomType(opt.roomType);
    // Only show room count when > 1 (multi-room bookings)
    const nights = opt.nights ? `${opt.nights} nights` : null;
    const occLabel = opt.occupancyType === 'SINGLE' ? 'Sgl' : opt.occupancyType === 'TRIPLE' ? 'Tpl' : 'Dbl';
    const segPax = opt.paxCount ?? pax;
    const occMeta = `${occLabel} occ. | ${segPax} pax | ${opt.roomCount ?? 1} room${(opt.roomCount ?? 1) !== 1 ? 's' : ''}`;
    const meta = [occMeta, nights, meal].filter(Boolean).join(' | ');
    lines.push(`• ${label}${meta ? ` (${meta})` : ''}`);
  }

  return lines.join('\n');
}

function renderCitySection(
  section: CitySection,
  globalIndex: { value: number },
  pax: number,
): string {
  const nightsLabel = section.nights ? ` — ${section.nights} nights` : '';
  const lines: string[] = [`📍 *${section.city.toUpperCase()}${nightsLabel}*`];

  if (section.isEmpty) {
    lines.push(`• [Hotel TBD]`);
  } else {
    for (const g of section.groups) {
      lines.push(renderGroup(g, globalIndex.value++, pax));
    }
  }

  return lines.join('\n');
}

const MEAL_PLAN_MAP: [RegExp, string][] = [
  [/ AI\b|-AI\b/i, 'All Inclusive'],
  [/ FB\b|-FB\b/i, 'Full Board'],
  [/ HB\b|-HB\b/i, 'Half Board (Breakfast & Dinner)'],
  [/ BB\b|-BB\b/i, 'Daily Breakfast'],
];

/** Infer meal plan label from roomType suffix (e.g. "Deluxe BB" → "Daily Breakfast"). */
function mealPlanFromRoomType(roomType?: string): string | null {
  if (!roomType) return null;
  for (const [re, label] of MEAL_PLAN_MAP) {
    if (re.test(roomType)) return label;
  }
  return null;
}

/** Collect unique meal plan labels across all hotel options in the lead. */
function collectMealPlans(lead: Lead, allGroups: HotelGroup[]): string[] {
  const plans = new Set<string>();

  // From roomType suffixes on hotel options
  for (const g of allGroups) {
    for (const o of g.options) {
      const p = mealPlanFromRoomType(o.roomType);
      if (p) plans.add(p);
    }
  }

  // From locations[].hotels[].mealPlan (itinerary hotels)
  for (const loc of lead.locations ?? []) {
    for (const h of loc.hotels ?? []) {
      if (h.mealPlan?.trim()) plans.add(h.mealPlan.trim());
    }
  }

  return [...plans];
}

// ── Main builder ──────────────────────────────────────────────────────────────

export interface WhatsAppQuoteOptions {
  staffName?: string;
}

export function buildWhatsAppQuote(lead: Lead, opts: WhatsAppQuoteOptions = {}): string {
  const currency = lead.currency ?? INTERNAL_CURRENCY;
  const pax = Math.max(1, (lead.adults ?? 0) + (lead.children ?? 0));
  const blocks: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────────────
  const range = dateRange(lead.travelDate, lead.returnDate);
  const dest = lead.destination ?? lead.locations?.map((l) => l.city).join(', ') ?? '';
  const titleParts = [dest ? `${dest} Package` : 'Package', range].filter(Boolean).join(' — ');
  const paxLabel = pax > 0 ? `${pax} pax` : '';
  blocks.push(`*${[titleParts, paxLabel].filter(Boolean).join(' | ')}*`);

  // ── Recipient ──────────────────────────────────────────────────────────────
  blocks.push(`For: ${lead.name}${lead.companyName ? ` (${lead.companyName})` : ''}`);

  // ── Hotels by city ─────────────────────────────────────────────────────────
  const normalised = (lead.hotelOptions ?? []).map((h) =>
    normalizeHotelOption(h, { pax, fallbackNights: lead.nights ?? 1, fallbackCurrency: currency }),
  );

  const allGroups = buildHotelGroups(normalised);
  const multiCity = (lead.locations?.length ?? 0) > 1 || allGroups.some((g, _, arr) =>
    arr.some((other) => (other.location ?? '') !== (g.location ?? '')),
  );

  if (multiCity) {
    const sections = buildCitySections(allGroups, lead);
    const counter = { value: 0 };
    const sectionBlocks = sections.map((s) => renderCitySection(s, counter, pax));
    blocks.push(sectionBlocks.join('\n\n'));
  } else if (allGroups.length > 0) {
    blocks.push(allGroups.map((g, i) => renderGroup(g, i, pax)).join('\n\n'));
  }

  // ── Services ────────────────────────────────────────────────────────────────
  // sellPrice on LeadServiceItem is already per-person:
  //   PRIVATE → basePricePerUnit (one unit per person, e.g. visa)
  //   SHARED  → (ceil(pax/capacity) × basePricePerUnit) / pax  (e.g. transfer sedan shared)
  // We intentionally do NOT show individual service prices — only the package total.
  const serviceItems = lead.serviceItems ?? [];
  const pricedServices = serviceItems.filter((s) => s.sellPrice != null && s.sellPrice > 0);

  // ── Includes list ──────────────────────────────────────────────────────────
  // Meal plan: use MEAL-category service names if present, otherwise infer from roomType suffix
  const mealServiceNames = serviceItems
    .filter((s) => s.categoryCode === 'MEAL')
    .map((s) => s.serviceName);
  const inferredMeals = mealServiceNames.length === 0 ? collectMealPlans(lead, allGroups) : [];

  const nonMealServiceNames = serviceItems.length > 0
    ? serviceItems.filter((s) => s.categoryCode !== 'MEAL').map((s) => s.serviceName)
    : (lead.services ?? []);

  const includesItems: string[] = [
    ...inferredMeals,
    ...mealServiceNames,
    ...nonMealServiceNames,
    'Taxes (excl. tourism dirham)',
  ];
  if (includesItems.length > 0) {
    blocks.push(`*Includes:* ${includesItems.join(' · ')}`);
  }

  // ── Consolidated per-person total ──────────────────────────────────────────
  // Hotel: pricePerPerson = (pricePerNight × roomCount × nights) / totalPax
  //   - roomCount honours explicit requests (triple sharing = 1 room ÷ 3 pax)
  // Services: sellPrice is already per-person
  //   - PRIVATE: basePricePerUnit per person (e.g. visa $95/person)
  //   - SHARED: (ceil(pax/capacity) × unit_cost) / pax (e.g. sedan shared)
  // Markup: percentage over cost price applied to the final total
  const blended = blendedHotelCostPerPax(normalised, pax);
  const recommended = normalised.find((h) => h.recommended) ?? normalised[0];
  const hotelUsd = blended != null
    ? toCustomerUsd(blended, currency)
    : recommended?.pricePerPerson != null
      ? toCustomerUsd(recommended.pricePerPerson, recommended.currency ?? currency)
      : null;
  if (hotelUsd != null) {
    const servicesUsd = pricedServices.reduce(
      (sum, s) => sum + toCustomerUsd(s.sellPrice ?? 0, s.currency ?? currency),
      0,
    );
    const markupFactor = lead.markup != null && lead.markup > 0 ? 1 + lead.markup / 100 : 1;
    const total = (hotelUsd + servicesUsd) * markupFactor;
    blocks.push(`💰 *Package from ${money(total, CUSTOMER_CURRENCY)}/person*`);
  }

  // ── Terms ──────────────────────────────────────────────────────────────────
  const validity = lead.quoteValidityHours ?? 48;
  blocks.push(`⚠️ ${validity} hours validity · Non-refundable · Subject to availability`);
  blocks.push('To confirm: full names + passport copies');

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
