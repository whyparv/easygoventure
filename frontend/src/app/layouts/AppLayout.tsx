import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from '@shared/components/layout/command-palette';
import { AIWidget } from '@shared/components/ai/ai-widget';
import { ErrorBoundary } from '@shared/components/ErrorBoundary';
import { Skeleton } from '@shared/components/ui/skeleton';

export function AppLayout() {
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
            <ErrorBoundary>
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <CommandPalette />
      <AIWidget />
    </div>
  );
}
