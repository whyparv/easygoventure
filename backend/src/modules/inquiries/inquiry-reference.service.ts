import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';

/**
 * Generates human-friendly inquiry references: `INQ-<year>-<5 digits>`.
 * Uniqueness is enforced by a unique index; the service retries on collision.
 */
@Injectable()
export class InquiryReferenceService {
  generate(): string {
    const year = new Date().getFullYear();
    const suffix = randomInt(0, 100_000).toString().padStart(5, '0');
    return `INQ-${year}-${suffix}`;
  }
}
