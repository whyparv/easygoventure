import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

function toDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

export function formatDate(value?: string | Date | null, pattern = 'dd MMM yyyy'): string {
  const date = toDate(value);
  return date ? format(date, pattern) : '—';
}

export function formatDateTime(value?: string | Date | null): string {
  return formatDate(value, 'dd MMM yyyy, HH:mm');
}

export function formatRelative(value?: string | Date | null): string {
  const date = toDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : '—';
}

/**
 * Static USD conversion rates. The app displays every monetary value in USD ($);
 * amounts stored in another currency (legacy AED, INR vendor rates, …) are
 * converted on the way to the screen. Unknown codes pass through 1:1.
 */
const USD_RATES: Record<string, number> = {
  USD: 1,
  AED: 0.2723, // pegged 3.6725
  INR: 0.012,
  EUR: 1.08,
  GBP: 1.27,
  SAR: 0.2666,
  QAR: 0.2747,
};

/** Convert an amount in `currency` to USD. */
export function toUsd(amount: number, currency = 'USD'): number {
  const rate = USD_RATES[(currency || 'USD').toUpperCase()] ?? 1;
  return amount * rate;
}

/**
 * Format a monetary value as USD ($). If the value is stored in another currency,
 * pass its code and it is converted first (AED/INR → $).
 */
export function formatCurrency(amount?: number, currency = 'USD'): string {
  if (amount === undefined || amount === null) return '—';
  const usd = toUsd(amount, currency);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(usd);
  } catch {
    return `$${Math.round(usd).toLocaleString()}`;
  }
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
