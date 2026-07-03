import {
  DEFAULT_CITY,
  DEFAULT_COUNTRY,
  HOTEL_CATEGORY,
  NormalizedHotel,
  RawHotelRecord,
  StarRating,
} from './hotel-catalog.types';

/**
 * HotelCatalogNormalizer
 * ----------------------
 * Stage 2. Turns an untrusted {@link RawHotelRecord} into a {@link NormalizedHotel}
 * with consistent casing/spacing and business defaults applied. It is deliberately
 * conservative: it fixes formatting artifacts but never rewrites a hotel's identity
 * (e.g. "Atlantis The Palm" stays "Atlantis The Palm").
 *
 * Applied rules (also documented in HOTEL_DATA_REPORT.md):
 *  - Names: strip control/zero-width chars, collapse whitespace, drop list
 *    numbering prefixes ("12. ", "3) "), trim stray leading/trailing punctuation.
 *  - Area: same whitespace/punctuation cleanup; empty becomes undefined.
 *  - Rating: resolve 3/4/5 from either "N-STAR" text or a run of star glyphs.
 *  - City / Country: default to Dubai / UAE when the source is silent.
 *
 * Regexes for invisible characters are built with the RegExp constructor from
 * pure-ASCII escape strings, so the source file itself contains no fragile
 * non-printing bytes.
 */
export class HotelCatalogNormalizer {
  private static readonly NBSP = new RegExp('\\u00A0', 'g');
  private static readonly ZERO_WIDTH = new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g');
  // eslint-disable-next-line no-control-regex -- deliberately strips control chars
  private static readonly CONTROL = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');
  private static readonly STAR_GLYPH = new RegExp(String.fromCodePoint(0x2b50), 'g');

  /** Rules applied at least once — surfaced in the report for auditability. */
  readonly appliedRules = new Set<string>();

  normalize(raw: RawHotelRecord): NormalizedHotel {
    return {
      name: this.normalizeName(raw.rawName),
      category: HOTEL_CATEGORY,
      starRating: this.normalizeRating(raw.rawRating),
      area: this.normalizeArea(raw.rawArea),
      city: DEFAULT_CITY,
      country: DEFAULT_COUNTRY,
      isActive: true,
      sourceRow: raw.sourceRow,
    };
  }

  normalizeAll(raws: RawHotelRecord[]): NormalizedHotel[] {
    // City/country are always defaulted for this Dubai dataset.
    this.appliedRules.add('city -> default "Dubai" when absent');
    this.appliedRules.add('country -> default "UAE" when absent');
    return raws.map((r) => this.normalize(r));
  }

  // ── Field normalizers ────────────────────────────────────────────────────

  normalizeName(input: string): string {
    const cleaned = this.stripInvisible(input).replace(/\s+/g, ' ').trim();

    // Drop list numbering that may have leaked into the name column ("12. ", "3) ").
    const denumbered = cleaned.replace(/^\d{1,3}[.)-]\s+/, '');
    if (denumbered !== cleaned) this.appliedRules.add('name -> remove leading list numbering');

    // Trim stray leading/trailing punctuation and wrapping quotes, but keep
    // meaningful interior characters (&, en-dash, apostrophe, etc.).
    const trimmed = denumbered
      .replace(/^["'.,;:\s]+/, '')
      .replace(/["'.,;:\s]+$/, '')
      .trim();
    if (trimmed !== denumbered) this.appliedRules.add('name -> trim stray punctuation/quotes');

    if (/\s{2,}/.test(input) || input !== input.trim()) {
      this.appliedRules.add('name -> collapse whitespace & trim');
    }
    return trimmed;
  }

  normalizeArea(input: string): string | undefined {
    const cleaned = this.stripInvisible(input)
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^["'.,;:\s]+/, '')
      .replace(/["'.,;:\s]+$/, '')
      .trim();
    if (!cleaned) return undefined;
    if (input.trim() !== cleaned) this.appliedRules.add('area -> clean whitespace/punctuation');
    return cleaned;
  }

  normalizeRating(input: string): StarRating | null {
    if (!input) return null;

    // Prefer an explicit "N-STAR" / "N STAR" token.
    const textual = input.match(/([345])\s*-?\s*star/i);
    if (textual) {
      this.appliedRules.add('rating -> parse "N-STAR" text');
      return Number(textual[1]) as StarRating;
    }

    // Fall back to counting star glyphs.
    const stars = (input.match(HotelCatalogNormalizer.STAR_GLYPH) ?? []).length;
    if (stars >= 3 && stars <= 5) {
      this.appliedRules.add('rating -> count star glyphs');
      return stars as StarRating;
    }

    // Last resort: a bare digit 3-5.
    const bare = input.match(/\b([345])\b/);
    if (bare) {
      this.appliedRules.add('rating -> bare digit fallback');
      return Number(bare[1]) as StarRating;
    }
    return null;
  }

  /** Remove control chars, zero-width chars, and normalize non-breaking spaces. */
  private stripInvisible(s: string): string {
    return s
      .replace(HotelCatalogNormalizer.NBSP, ' ')
      .replace(HotelCatalogNormalizer.ZERO_WIDTH, '')
      .replace(HotelCatalogNormalizer.CONTROL, ' ');
  }
}
