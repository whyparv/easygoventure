import { Suspense } from 'react';
import { AppProviders } from '@app/providers/AppProviders';
import { AppRouter } from '@app/router/AppRouter';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import { AuthBoot } from '@shared/components/AuthBoot';

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AuthBoot>
          <Suspense fallback={null}>
            <AppRouter />
          </Suspense>
        </AuthBoot>
      </AppProviders>
    </ErrorBoundary>
  );
}
