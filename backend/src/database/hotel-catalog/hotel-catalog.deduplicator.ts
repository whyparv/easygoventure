import { DedupResult, DuplicateCandidate, NormalizedHotel } from './hotel-catalog.types';

/**
 * HotelCatalogDeduplicator
 * ------------------------
 * Stage 4. Collapses records that are unambiguously the same hotel and FLAGS
 * (without merging) records that are only possibly the same.
 *
 * Uniqueness key: slug(name) + '|' + slug(city) — case- and punctuation-insensitive,
 * matching the seeder's idempotency key (name + city).
 *
 * Classification:
 *  - EXACT_DUPLICATE  — same key AND same rating -> drop the later occurrence.
 *  - RATING_CONFLICT  — same key but DIFFERENT rating -> keep the first, flag loudly
 *                       (a human must decide; e.g. a hotel listed under two tables).
 *  - NEAR_DUPLICATE   — different keys but high name similarity -> keep BOTH, flag
 *                       for review. We never blindly merge uncertain records.
 */
export class HotelCatalogDeduplicator {
  /** Similarity at/above which two distinct names are flagged as near-duplicates. */
  private static readonly NEAR_THRESHOLD = 0.82;

  dedupe(records: NormalizedHotel[]): DedupResult {
    const unique: NormalizedHotel[] = [];
    const candidates: DuplicateCandidate[] = [];
    const byKey = new Map<string, NormalizedHotel>();

    for (const record of records) {
      const key = this.key(record);
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, record);
        unique.push(record);
        continue;
      }

      if (existing.starRating === record.starRating) {
        candidates.push({
          kind: 'EXACT_DUPLICATE',
          key,
          kept: existing,
          dropped: record,
          note: `Duplicate of row ${existing.sourceRow}; later occurrence dropped.`,
        });
      } else {
        candidates.push({
          kind: 'RATING_CONFLICT',
          key,
          kept: existing,
          dropped: record,
          note:
            `"${record.name}" appears with conflicting ratings ` +
            `(${existing.starRating}-star @ row ${existing.sourceRow} vs ` +
            `${record.starRating}-star @ row ${record.sourceRow}). ` +
            `Kept the first; needs business review.`,
        });
      }
    }

    // Near-duplicate scan across the surviving unique set (O(n^2) — the catalog is small).
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) {
        const a = unique[i];
        const b = unique[j];
        const sim = this.similarity(a.name, b.name);
        if (sim >= HotelCatalogDeduplicator.NEAR_THRESHOLD) {
          candidates.push({
            kind: 'NEAR_DUPLICATE',
            key: `${this.key(a)} ~ ${this.key(b)}`,
            kept: a,
            other: b,
            similarity: Number(sim.toFixed(3)),
            note: `Possible duplicate: "${a.name}" vs "${b.name}" (both kept — review).`,
          });
        }
      }
    }

    return { unique, candidates };
  }

  /** Idempotency key mirrored by the Mongo seeder: normalized name + city. */
  key(record: NormalizedHotel): string {
    return `${this.slug(record.name)}|${this.slug(record.city)}`;
  }

  private slug(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  /**
   * Token-based Jaccard similarity with a prefix boost. Good enough to surface
   * "X" vs "X Dubai" style candidates without over-flagging genuinely distinct
   * properties that merely share a brand ("Grand Excelsior Al Barsha" vs "... Deira").
   */
  private similarity(a: string, b: string): number {
    const sa = this.slug(a);
    const sb = this.slug(b);
    if (sa === sb) return 1;
    if (sa.startsWith(sb) || sb.startsWith(sa)) return 0.9;

    const ta = new Set(this.tokens(a));
    const tb = new Set(this.tokens(b));
    if (ta.size === 0 || tb.size === 0) return 0;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter += 1;
    return inter / (ta.size + tb.size - inter);
  }

  private tokens(s: string): string[] {
    return s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1);
  }
}
