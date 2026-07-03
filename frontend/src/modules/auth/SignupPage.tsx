import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Plane } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { FormInput } from '@shared/components/form';
import { ApiError } from '@shared/api/http';
import { authService } from '@shared/services/auth.service';
import { useAuthStore } from '@shared/stores/auth.store';
import { ROUTES } from '@app/config/routes';

const schema = z.object({
  organizationName: z.string().min(2, 'Agency name is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type SignupForm = z.infer<typeof schema>;

export default function SignupPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<SignupForm>({
    resolver: zodResolver(schema),
    defaultValues: { organizationName: '', firstName: '', lastName: '', email: '', password: '' },
  });

  if (status === 'authenticated') return <Navigate to={ROUTES.dashboard} replace />;

  const onSubmit = async (values: SignupForm) => {
    setError(null);
    try {
      await authService.register(values);
      // Deliberately no auto-login: send the new owner to sign in explicitly.
      navigate(ROUTES.login, { replace: true, state: { registered: true, email: values.email } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to create your account. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Plane className="size-6" />
          </div>
          <h1 className="mt-3 text-xl font-semibold text-foreground">Create your workspace</h1>
          <p className="text-sm text-muted-foreground">Set up your agency on EasyGoVenture in seconds</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <FormInput
              name="organizationName"
              control={control}
              label="Agency name"
              placeholder="Acme DMC"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <FormInput name="firstName" control={control} label="First name" placeholder="Aisha" autoComplete="given-name" />
              <FormInput name="lastName" control={control} label="Last name" placeholder="Khan" autoComplete="family-name" />
            </div>
            <FormInput
              name="email"
              control={control}
              label="Work email"
              type="email"
              autoComplete="email"
              placeholder="you@agency.com"
            />
            <FormInput
              name="password"
              control={control}
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />

            <Button type="submit" className="w-full" loading={formState.isSubmitting}>
              Create account
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
