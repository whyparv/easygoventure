import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { useAuthStore } from '@shared/stores/auth.store';
import { EmptyState } from '@shared/components/ui/empty-state';
import { ROUTES } from '@app/config/routes';

/**
 * Gate the app shell. Unauthenticated users are redirected to /login with the
 * intended location preserved so they land back where they were after signing in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status !== 'authenticated') {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

/** Show a 403 page when the principal lacks the required permission. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const allowed = useAuthStore((s) => s.hasPermission(permission));
  if (!allowed) return <ForbiddenPage />;
  return <>{children}</>;
}

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={ShieldX}
        title="403 — Access denied"
        description="You don't have permission to view this page. Ask an administrator if you need access."
      />
    </div>
  );
}
