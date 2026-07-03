/**
 * Shared types for the hotel-catalog data pipeline:
 *
 *   Raw Asset (.docx) → Parse → Normalize → Validate → Deduplicate → Clean JSON → Seed
 *
 * Each stage has a dedicated class (Parser / Normalizer / Validator / Deduplicator)
 * so the transformation is auditable and testable end-to-end.
 */

/** Star rating supported by the source dataset. */
export type StarRating = 3 | 4 | 5;

/** Fixed catalog category for every hotel record. */
export const HOTEL_CATEGORY = 'HOTEL' as const;

/** Business defaults applied when the source omits a field. */
export const DEFAULT_CITY = 'Dubai' as const;
export const DEFAULT_COUNTRY = 'UAE' as const;

/**
 * Stage 1 output — a raw, untrusted row exactly as pulled from the document.
 * No cleaning is applied yet; every value is a string (possibly empty/dirty).
 */
export interface RawHotelRecord {
  rawName: string;
  rawArea: string;
  rawRating: string;
  /** 1-based source row index, for traceability in the data-quality report. */
  sourceRow: number;
}

/**
 * Stage 2 output — a normalized record with business defaults applied.
 * `starRating` may still be null if the source rating could not be resolved
 * (the validator rejects those downstream).
 */
export interface NormalizedHotel {
  name: string;
  category: typeof HOTEL_CATEGORY;
  starRating: StarRating | null;
  area?: string;
  city: string;
  country: string;
  isActive: boolean;
  /** Provenance from the raw stage — kept internal, stripped before seeding. */
  sourceRow: number;
}

/** A fully valid, seed-ready hotel record (the shape written to hotels.cleaned.json). */
export interface CleanHotel {
  name: string;
  category: typeof HOTEL_CATEGORY;
  starRating: StarRating;
  area?: string;
  city: string;
  country: string;
  isActive: boolean;
}

/** A record the validator refused, with a machine-readable reason. */
export interface RejectedHotel {
  record: NormalizedHotel | RawHotelRecord;
  reason: string;
}

export interface ValidationResult {
  valid: NormalizedHotel[];
  rejected: RejectedHotel[];
  /** Non-fatal issues (e.g. missing area) that do not block seeding. */
  warnings: string[];
}

/** A pair of records the deduplicator considers a possible (not certain) duplicate. */
export interface DuplicateCandidate {
  kind: 'EXACT_DUPLICATE' | 'RATING_CONFLICT' | 'NEAR_DUPLICATE';
  key: string;
  kept: NormalizedHotel;
  dropped?: NormalizedHotel;
  /** For NEAR_DUPLICATE both records are kept; this is the other one. */
  other?: NormalizedHotel;
  similarity?: number;
  note: string;
}

export interface DedupResult {
  unique: NormalizedHotel[];
  candidates: DuplicateCandidate[];
}

/** Aggregate stats surfaced in HOTEL_DATA_REPORT.md. */
export interface PipelineStats {
  sourceFile: string;
  sectionsDetected: string[];
  totalRowsScanned: number;
  headerRowsSkipped: number;
  totalRecordsParsed: number;
  validRecords: number;
  rejectedRecords: number;
  exactDuplicates: number;
  ratingConflicts: number;
  nearDuplicateCandidates: number;
  missingAreaRecords: number;
  finalSeedCount: number;
  byRating: Record<string, number>;
}
