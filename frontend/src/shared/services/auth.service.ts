import { http } from '@shared/api/http';
import type { AuthResult, AuthUser } from '@shared/types/auth';

export interface RegisterInput {
  organizationName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export const authService = {
  register: (input: RegisterInput) => http.post<AuthResult>('/auth/register', input),
  login: (email: string, password: string) =>
    http.post<AuthResult>('/auth/login', { email, password }),
  me: () => http.get<AuthUser>('/auth/me'),
  logout: (refreshToken?: string | null) =>
    http.post<{ success: boolean }>('/auth/logout', { refreshToken: refreshToken ?? undefined }),
};
