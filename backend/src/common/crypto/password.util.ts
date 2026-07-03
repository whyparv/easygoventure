import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing using Node's built-in scrypt (memory-hard KDF) — no native
 * dependency required. Stored format is self-describing so parameters can evolve:
 *
 *   scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>
 */
const SCRYPT_N = 16384; // CPU/memory cost
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/** Constant-time verification. Returns false for any missing or malformed stored value. */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (typeof stored !== 'string' || stored.length === 0) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
