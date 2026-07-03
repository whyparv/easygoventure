import { createHash, randomBytes, randomUUID } from 'node:crypto';

/**
 * Opaque-token helpers for refresh tokens, password-reset tokens, etc.
 *
 * We store only the SHA-256 hash of these secrets, never the raw value, so a
 * database leak does not expose usable tokens. The raw token is returned to the
 * caller once (in the API response / reset link) and never persisted.
 */

/** Cryptographically-random URL-safe token. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Stable one-way hash used as the stored/lookup value for a token. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Random identifier for sessions/devices. */
export function generateId(): string {
  return randomUUID();
}
