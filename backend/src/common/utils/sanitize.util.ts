/**
 * Input normalisation applied before persistence. Trims, collapses duplicate
 * whitespace, and canonicalises the common contact fields so records are clean
 * and de-duplicable. All functions are null-safe and never throw.
 */

/** Trim + collapse internal whitespace to single spaces. */
export function sanitizeText(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length ? cleaned : undefined;
}

/** A person / company name — same as text (case preserved to respect real names). */
export function sanitizeName(value?: string | null): string | undefined {
  return sanitizeText(value);
}

/** A destination — trimmed + whitespace-collapsed. */
export function sanitizeDestination(value?: string | null): string | undefined {
  return sanitizeText(value);
}

/** Phone / WhatsApp — keep a single leading '+' and digits only. */
export function sanitizePhone(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const hasPlus = value.trim().startsWith('+');
  const digits = value.replace(/\D/g, '');
  if (!digits.length) return undefined;
  return (hasPlus ? '+' : '') + digits;
}

/** Email — trimmed + lower-cased. */
export function sanitizeEmail(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/\s+/g, '').trim().toLowerCase();
  return cleaned.length ? cleaned : undefined;
}
