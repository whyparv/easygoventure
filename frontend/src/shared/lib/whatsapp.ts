import type { Lead, LeadHotelOption } from '@shared/types/domain';
import {
  CUSTOMER_CURRENCY,
  INTERNAL_CURRENCY,
  blendedHotelCostPerPax,
  normalizeHotelOption,
  toCustomerUsd,
} from './lead-pricing';

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$', AED: 'AED ', EUR: '€', GBP: '£', NGN: '₦',
};

function money(amount: number, currency = 'USD'): string {
  const sym = CURRENCY_SYMBOL[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
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
  options: LeadHotelOption[];
}

interface CitySection {
  city: string;
  nights?: number;
  groups: HotelGroup[];
  isEmpty: boolean;
  hintRating?: number;
}

function hotelGroupKey(opt: LeadHotelOption): string {
  return `${opt.name ?? ''}|${opt.location ?? ''}|${opt.starRating ?? ''}`.toLowerCase();
}

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

  // Filter blank roomType entries when typed siblings exist in the same group
  for (const g of groupMap.values()) {
    const hasTyped = g.options.some((o) => o.roomType?.trim());
    if (hasTyped) g.options = g.options.filter((o) => o.roomType?.trim());
    g.options.sort((a, b) => {
      const aHasType = a.roomType?.trim() ? 0 : 1;
      const bHasType = b.roomType?.trim() ? 0 : 1;
      if (aHasType !== bHasType) return aHasType - bHasType;
      return (a.pricePerPerson ?? 0) - (b.pricePerPerson ?? 0);
    });
  }

  return [...groupMap.values()];
}

function buildCitySections(allGroups: HotelGroup[], lead: Lead): CitySection[] {
  const locationOrder: string[] = (lead.locations ?? []).map((l) => l.city);

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
      const cityGroups = allGroups.filter((g) => (g.location ?? '').toLowerCase() === key);
      sectionMap.set(key, { city, nights, groups: cityGroups, isEmpty: cityGroups.length === 0 });
    }
  }

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

// ── Meal plan ─────────────────────────────────────────────────────────────────

const MEAL_PLAN_MAP: [RegExp, string][] = [
  [/ AI\b|-AI\b/i, 'All Inclusive'],
  [/ FB\b|-FB\b/i, 'Full Board'],
  [/ HB\b|-HB\b/i, 'Half Board (Breakfast & Dinner)'],
  [/ BB\b|-BB\b/i, 'Daily Breakfast'],
];

function mealPlanFromRoomType(roomType?: string): string | null {
  if (!roomType) return null;
  for (const [re, label] of MEAL_PLAN_MAP) {
    if (re.test(roomType)) return label;
  }
  return null;
}

function collectMealPlans(lead: Lead, allGroups: HotelGroup[]): string[] {
  const plans = new Set<string>();
  for (const g of allGroups) {
    for (const o of g.options) {
      const p = mealPlanFromRoomType(o.roomType);
      if (p) plans.add(p);
    }
  }
  for (const loc of lead.locations ?? []) {
    for (const h of loc.hotels ?? []) {
      if (h.mealPlan?.trim()) plans.add(h.mealPlan.trim());
    }
  }
  return [...plans];
}

// ── Per-option hotel cost ─────────────────────────────────────────────────────

/**
 * Compute USD hotel cost per person for a single hotel group.
 * Handles mixed occupancy (paxCount segments) via blended average.
 */
function groupHotelCostUsd(group: HotelGroup, pax: number, currency: string): number | null {
  const blended = blendedHotelCostPerPax(group.options, pax);
  if (blended != null) return toCustomerUsd(blended, currency);
  const first = group.options.find((o) => o.pricePerPerson != null);
  if (!first) return null;
  return toCustomerUsd(first.pricePerPerson!, first.currency ?? currency);
}

// ── Hotel rendering ───────────────────────────────────────────────────────────

/**
 * Render one hotel option block (used both inside city sections and standalone).
 * `optionIndex` is the 1-based option number shown to the agency.
 */
function renderGroup(group: HotelGroup, optionIndex: number, pax: number): string {
  const lines: string[] = [];
  const checkmark = group.recommended ? ' ✅' : '';
  lines.push(`*Option ${optionIndex} — ${group.name}*${stars(group.starRating)}${checkmark}`);

  for (const opt of group.options) {
    const label = opt.roomType?.trim() || 'Room';
    const meal = mealPlanFromRoomType(opt.roomType);
    const nights = opt.nights ? `${opt.nights} nights` : null;
    const occLabel =
      opt.occupancyType === 'SINGLE' ? 'Sgl' : opt.occupancyType === 'TRIPLE' ? 'Tpl' : 'Dbl';
    const segPax = opt.paxCount ?? pax;
    const occMeta = `${occLabel} occ. | ${segPax} pax | ${opt.roomCount ?? 1} room${(opt.roomCount ?? 1) !== 1 ? 's' : ''}`;
    const meta = [occMeta, nights, meal].filter(Boolean).join(' | ');
    lines.push(`• ${label}${meta ? ` (${meta})` : ''}`);
  }

  return lines.join('\n');
}

function renderCitySection(
  section: CitySection,
  globalOptionIndex: { value: number },
  pax: number,
): string {
  const nightsLabel = section.nights ? ` — ${section.nights} nights` : '';
  const lines: string[] = [`📍 *${section.city.toUpperCase()}${nightsLabel}*`];

  if (section.isEmpty) {
    lines.push(`• [Hotel TBD]`);
  } else {
    for (const g of section.groups) {
      lines.push(renderGroup(g, globalOptionIndex.value++, pax));
    }
  }

  return lines.join('\n');
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
  const multiCity =
    (lead.locations?.length ?? 0) > 1 ||
    allGroups.some((g, _, arr) => arr.some((o) => (o.location ?? '') !== (g.location ?? '')));

  const counter = { value: 1 };

  if (multiCity) {
    const sections = buildCitySections(allGroups, lead);
    blocks.push(sections.map((s) => renderCitySection(s, counter, pax)).join('\n\n'));
  } else if (allGroups.length > 0) {
    blocks.push(allGroups.map((g) => renderGroup(g, counter.value++, pax)).join('\n\n'));
  }

  // ── Services ────────────────────────────────────────────────────────────────
  const serviceItems = lead.serviceItems ?? [];
  const pricedServices = serviceItems.filter((s) => s.sellPrice != null && s.sellPrice > 0);

  // ── Includes list ──────────────────────────────────────────────────────────
  const mealServiceNames = serviceItems.filter((s) => s.categoryCode === 'MEAL').map((s) => s.serviceName);
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

  // ── Pricing ────────────────────────────────────────────────────────────────
  // Services cost is the same regardless of which hotel option the agency selects.
  const servicesUsd = pricedServices.reduce(
    (sum, s) => sum + toCustomerUsd(s.sellPrice ?? 0, s.currency ?? currency),
    0,
  );
  const markupFactor =
    lead.markup != null && lead.markup > 0 ? 1 + lead.markup / 100 : 1;

  // Compute per-group hotel costs
  const groupCosts = allGroups.map((g) => groupHotelCostUsd(g, pax, currency));
  const hasCosts = groupCosts.some((c) => c != null);

  if (hasCosts) {
    if (allGroups.length === 1) {
      // Single option — one consolidated price
      const hotelUsd = groupCosts[0]!;
      const total = (hotelUsd + servicesUsd) * markupFactor;
      blocks.push(`💰 *Package from ${money(total, CUSTOMER_CURRENCY)}/person*`);
    } else {
      // Multiple options — show a per-option pricing table so the agency can
      // present alternatives to the traveler and choose.
      const pricingLines = allGroups.map((g, i) => {
        const hotelUsd = groupCosts[i];
        if (hotelUsd == null) return `• Option ${i + 1} (${g.name}): price TBD`;
        const total = (hotelUsd + servicesUsd) * markupFactor;
        const stars_ = g.starRating ? ` ${g.starRating}★` : '';
        return `• Option ${i + 1} (${g.name}${stars_}): *${money(total, CUSTOMER_CURRENCY)}/pax*`;
      });
      blocks.push(`💰 *Pricing per person (all-in):*\n${pricingLines.join('\n')}`);
    }
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
