import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * HotelCatalogRecord
 * ------------------
 * The file-based, environment-independent hotel catalog contract. This is the
 * shape persisted to `assets/catalog/hotels/dubai.hotels.json` — the single
 * source of truth consumed by both the database seeder and the runtime JSON
 * fallback. It is intentionally minimal and transport-agnostic (no database
 * concepts like `_id`, `isDeleted`, timestamps).
 */
export interface HotelCatalogRecord {
  name: string;
  city: string;
  country: string;
  /** Star rating (integer 1–5; the Dubai dataset is 3–5). */
  rating: number;
  address?: string;
}

/**
 * API-facing hotel shape, produced from EITHER the database document or a file
 * record, so callers see a consistent contract regardless of the data source.
 */
export interface HotelView {
  id: string;
  name: string;
  category: string;
  starRating: number;
  area?: string;
  city: string;
  country: string;
  isActive: boolean;
  /** Present only when served from the JSON fallback (database unavailable). */
  source?: 'file';
}

export interface RecordValidationIssue {
  index: number;
  reason: string;
  record: unknown;
}

const VALID_RATINGS = new Set([1, 2, 3, 4, 5]);

/** Validate one untrusted value against the HotelCatalogRecord contract. */
export function validateHotelCatalogRecord(value: unknown): { valid: boolean; reason?: string } {
  if (typeof value !== 'object' || value === null) {
    return { valid: false, reason: 'record is not an object' };
  }
  const r = value as Record<string, unknown>;
  if (typeof r.name !== 'string' || r.name.trim().length < 2) {
    return { valid: false, reason: 'name is missing or too short' };
  }
  if (typeof r.city !== 'string' || r.city.trim().length === 0) {
    return { valid: false, reason: 'city is missing' };
  }
  if (typeof r.country !== 'string' || r.country.trim().length === 0) {
    return { valid: false, reason: 'country is missing' };
  }
  if (typeof r.rating !== 'number' || !Number.isInteger(r.rating) || !VALID_RATINGS.has(r.rating)) {
    return { valid: false, reason: 'rating must be an integer between 1 and 5' };
  }
  if (r.address !== undefined && typeof r.address !== 'string') {
    return { valid: false, reason: 'address must be a string when present' };
  }
  return { valid: true };
}

/**
 * Split a raw JSON array into cleaned valid records and rejected rows. Never
 * throws on a bad row — invalid records are collected as issues so a single
 * malformed entry can't take down the whole catalog.
 */
export function parseHotelCatalog(raw: unknown): {
  records: HotelCatalogRecord[];
  issues: RecordValidationIssue[];
} {
  if (!Array.isArray(raw)) {
    throw new Error('Hotel catalog dataset must be a JSON array');
  }
  const records: HotelCatalogRecord[] = [];
  const issues: RecordValidationIssue[] = [];
  raw.forEach((item, index) => {
    const check = validateHotelCatalogRecord(item);
    if (!check.valid) {
      issues.push({ index, reason: check.reason ?? 'invalid', record: item });
      return;
    }
    const r = item as Record<string, unknown>;
    const address = typeof r.address === 'string' ? r.address.trim() : '';
    records.push({
      name: (r.name as string).trim(),
      city: (r.city as string).trim(),
      country: (r.country as string).trim(),
      rating: r.rating as number,
      ...(address ? { address } : {}),
    });
  });
  return { records, issues };
}

// The backend root, resolved relative to this compiled module. Works from both
// `src/**` (ts-node) and `dist/**` (nest build) — both sit four levels deep.
const BACKEND_ROOT = resolve(__dirname, '../../../..');

/** Canonical location of the file-based hotel catalog. */
export const HOTEL_CATALOG_DIR = join(BACKEND_ROOT, 'assets', 'catalog', 'hotels');
export const HOTEL_CATALOG_FILE = join(HOTEL_CATALOG_DIR, 'dubai.hotels.json');

/**
 * Read + validate the file-based catalog. Throws if the file is absent or the
 * JSON is malformed (callers that must tolerate absence should catch).
 */
export function readHotelCatalogFile(path: string = HOTEL_CATALOG_FILE): {
  records: HotelCatalogRecord[];
  issues: RecordValidationIssue[];
  path: string;
} {
  if (!existsSync(path)) {
    throw new Error(
      `Hotel catalog file not found at ${path}. Run "npm run hotels:build" to generate it.`,
    );
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const { records, issues } = parseHotelCatalog(raw);
  return { records, issues, path };
}

/**
 * Deterministic, stable id for a file record derived from `name + city`, so a
 * list response and a subsequent get-by-id agree without any database.
 */
export function hotelCatalogRecordId(record: HotelCatalogRecord): string {
  return createHash('sha256')
    .update(`${record.name.toLowerCase()}|${record.city.toLowerCase()}`)
    .digest('hex')
    .slice(0, 24);
}

/** Map a file record to the API-facing hotel view (flagged as file-sourced). */
export function recordToView(record: HotelCatalogRecord): HotelView {
  return {
    id: hotelCatalogRecordId(record),
    name: record.name,
    category: 'HOTEL',
    starRating: record.rating,
    ...(record.address ? { area: record.address } : {}),
    city: record.city,
    country: record.country,
    isActive: true,
    source: 'file',
  };
}
