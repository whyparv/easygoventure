import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from './ThemeProvider';
import { QueryProvider } from './QueryProvider';
import { TooltipProvider } from '@shared/components/ui/tooltip';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <QueryProvider>
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                className:
                  'rounded-lg border border-border bg-card text-foreground shadow-md text-sm',
              }}
            />
          </TooltipProvider>
        </ThemeProvider>
      </QueryProvider>
    </BrowserRouter>
  );
}
