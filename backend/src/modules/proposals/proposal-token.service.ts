import { Injectable } from '@nestjs/common';

/**
 * Generates human-shareable proposal reference tokens, e.g. `PRP-2026-83929`.
 *
 * Uniqueness is enforced by a unique index on `Proposal.generatedToken`; the
 * service that persists proposals retries on the (rare) collision.
 */
@Injectable()
export class ProposalTokenService {
  private readonly prefix = 'PRP';

  generate(): string {
    const year = new Date().getFullYear();
    const sequence = Math.floor(10000 + Math.random() * 90000); // 5 digits
    return `${this.prefix}-${year}-${sequence}`;
  }
}
