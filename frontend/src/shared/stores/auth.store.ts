import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResult, AuthUser } from '@shared/types/auth';

/** unknown = boot check pending; resolved to authenticated / unauthenticated. */
export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  setSession: (result: AuthResult) => void;
  setUser: (user: AuthUser) => void;
  setStatus: (status: AuthStatus) => void;
  clearSession: () => void;
  hasPermission: (permission: string) => boolean;
}

/**
 * Central auth state. Tokens + user are persisted to localStorage so the session
 * survives a refresh / browser restart; `status` is NOT persisted — it is resolved
 * on boot by AuthBoot (validate token → authenticated, else unauthenticated).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      status: 'unknown',
      setSession: (result) =>
        set({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
          status: 'authenticated',
        }),
      setUser: (user) => set({ user, status: 'authenticated' }),
      setStatus: (status) => set({ status }),
      clearSession: () =>
        set({ accessToken: null, refreshToken: null, user: null, status: 'unauthenticated' }),
      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        if (user.isSuperAdmin || user.permissions.includes('*')) return true;
        return user.permissions.includes(permission);
      },
    }),
    {
      name: 'dmc-crm-auth',
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user }),
    },
  ),
);

/** True if the current principal holds the permission (used outside React). */
export function principalHasPermission(permission: string): boolean {
  return useAuthStore.getState().hasPermission(permission);
}
