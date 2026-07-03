import { useEffect, type ReactNode } from 'react';
import { useUiStore } from '@shared/stores/ui.store';

/**
 * Reflects the persisted theme onto the <html> element so Tailwind's
 * `dark:` variants react to the UI store.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return <>{children}</>;
}
