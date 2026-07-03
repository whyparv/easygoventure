import { useEffect, useState, type ReactNode } from 'react';
import { Plane } from 'lucide-react';
import { useAuthStore } from '@shared/stores/auth.store';
import { authService } from '@shared/services/auth.service';

/**
 * Boot-time session restoration. If a token was persisted, validate it against
 * /auth/me (the HTTP layer transparently refreshes an expired access token). On
 * success the principal is hydrated; on failure the session is cleared. A splash
 * is shown until the check resolves so protected content never flashes and the
 * router never jumps.
 */
export function AuthBoot({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const { accessToken, setUser, clearSession, setStatus } = useAuthStore.getState();

    if (!accessToken) {
      setStatus('unauthenticated');
      setReady(true);
      return;
    }

    void (async () => {
      try {
        const user = await authService.me();
        if (active) setUser(user);
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Plane className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">Restoring your session…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
