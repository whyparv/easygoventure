/**
 * Shape of the JWT payload signed by the auth service.
 *
 * The access token stays intentionally small — it carries identity + tenant, and
 * the JwtStrategy resolves fresh roles/permissions from the database on every
 * request so role changes, lockouts and deactivations take effect immediately.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string | null;
  /** Distinguishes access vs refresh tokens. */
  type: 'access' | 'refresh';
  /** Session id — present on refresh tokens for rotation/revocation. */
  sid?: string;
  /** Unique per-issue nonce so tokens are never byte-identical (even same-second). */
  jti?: string;
  iat?: number;
  exp?: number;
}

/**
 * The principal attached to `request.user` after successful authentication.
 * `permissions` is the effective, resolved set (may be `['*']` for SUPER_ADMIN).
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  organizationId: string | null;
  departmentId: string | null;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}
