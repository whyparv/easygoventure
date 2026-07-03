/**
 * Currency normalization — the platform reports every monetary value in USD ($).
 *
 * Records may still store amounts in their native currency (legacy AED data,
 * INR-denominated vendor rates, etc.). These helpers convert any such amount to
 * USD so services, aggregations and exports speak a single currency. New records
 * default to USD (see the schema/DTO defaults), so conversion is a no-op for them.
 *
 * Rates are static, indicative mid-market approximations — intentionally simple
 * and dependency-free. If live FX ever matters, swap `USD_RATES` for a provider
 * lookup; every call site already funnels through `toUsd`.
 */
export const USD_RATES: Readonly<Record<string, number>> = {
  USD: 1,
  AED: 0.2723, // 1 AED ≈ 0.2723 USD (pegged 3.6725)
  INR: 0.012, // 1 INR ≈ 0.012 USD
  EUR: 1.08,
  GBP: 1.27,
  SAR: 0.2666,
  QAR: 0.2747,
};

/** Convert an amount in `currency` to USD, rounded to cents. Unknown codes pass through 1:1. */
export function toUsd(amount: number, currency: string = 'USD'): number {
  if (!Number.isFinite(amount)) return 0;
  const rate = USD_RATES[(currency || 'USD').toUpperCase()] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

/** Format an amount (given in `currency`) as a USD string, e.g. "$1,234". */
export function formatUsd(amount: number, currency: string = 'USD'): string {
  const usd = toUsd(amount, currency);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(usd);
}
