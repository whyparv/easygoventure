import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Plane } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { FormInput } from '@shared/components/form';
import { ApiError } from '@shared/api/http';
import { authService } from '@shared/services/auth.service';
import { useAuthStore } from '@shared/stores/auth.store';
import { ROUTES } from '@app/config/routes';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});
type LoginForm = z.infer<typeof schema>;

interface LocationState {
  from?: { pathname?: string };
  registered?: boolean;
  email?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);

  const state = location.state as LocationState | null;
  const from = state?.from?.pathname ?? ROUTES.dashboard;
  const justRegistered = Boolean(state?.registered);

  const { control, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: state?.email ?? '', password: '', rememberMe: true },
  });

  // Already signed in → bounce to the app.
  if (status === 'authenticated') return <Navigate to={from} replace />;

  const onSubmit = async (values: LoginForm) => {
    setError(null);
    try {
      const result = await authService.login(values.email, values.password);
      qc.clear();
      setSession(result);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to sign in. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Plane className="size-6" />
          </div>
          <h1 className="mt-3 font-brand text-3xl font-semibold tracking-wide text-foreground">
            EasyGoVenture
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to your operations workspace</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {justRegistered && !error && (
              <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>Workspace created — sign in with your new credentials.</span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <FormInput
              name="email"
              control={control}
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@agency.com"
              autoFocus
            />
            <FormInput
              name="password"
              control={control}
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                defaultChecked
                className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                onChange={() => {
                  /* session persists to localStorage so the demo survives restarts */
                }}
              />
              Keep me signed in
            </label>

            <Button type="submit" className="w-full" loading={formState.isSubmitting}>
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          New to EasyGoVenture?{' '}
          <Link to={ROUTES.signup} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Demo login: <span className="font-mono">owner@dmc.local</span> /{' '}
          <span className="font-mono">ChangeMe123!</span>
        </p>
      </div>
    </div>
  );
}
