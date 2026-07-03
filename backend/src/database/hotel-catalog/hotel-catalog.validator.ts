import { NormalizedHotel, ValidationResult } from './hotel-catalog.types';

/**
 * HotelCatalogValidator
 * ---------------------
 * Stage 3. Enforces the minimum contract for a seed-ready hotel and separates
 * clean records from records that must be rejected or flagged.
 *
 *  - Required: `name` (non-empty), `starRating` in {3,4,5}.
 *  - Optional: `area` (missing area is a warning, not a rejection).
 *
 * Nothing is silently dropped: every rejection carries a machine-readable reason
 * and every soft issue is captured as a warning for HOTEL_DATA_REPORT.md.
 */
export class HotelCatalogValidator {
  validate(records: NormalizedHotel[]): ValidationResult {
    const valid: NormalizedHotel[] = [];
    const rejected: ValidationResult['rejected'] = [];
    const warnings: string[] = [];

    for (const record of records) {
      const reason = this.rejectionReason(record);
      if (reason) {
        rejected.push({ record, reason });
        continue;
      }
      if (!record.area) {
        warnings.push(`Row ${record.sourceRow}: "${record.name}" has no area (kept).`);
      }
      valid.push(record);
    }

    return { valid, rejected, warnings };
  }

  /** Returns a rejection reason, or null if the record is valid. */
  private rejectionReason(record: NormalizedHotel): string | null {
    if (!record.name || record.name.trim().length === 0) {
      return 'EMPTY_NAME';
    }
    if (record.name.trim().length < 2) {
      return 'NAME_TOO_SHORT';
    }
    if (record.starRating === null) {
      return 'MISSING_RATING';
    }
    if (![3, 4, 5].includes(record.starRating)) {
      return `INVALID_RATING(${record.starRating})`;
    }
    return null;
  }
}
