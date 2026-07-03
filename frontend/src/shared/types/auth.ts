/** The authenticated principal returned by /auth/login and /auth/me. */
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId: string | null;
  departmentId?: string | null;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

/** The token pair + principal returned by /auth/login and /auth/refresh. */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
}
