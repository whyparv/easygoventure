import { Moon, Sun } from 'lucide-react';
import { PageHeader } from '@shared/components/layout/page-header';
import { SectionCard } from '@shared/components/ui/card';
import { Button } from '@shared/components/ui/button';
import { Badge } from '@shared/components/ui/badge';
import { useUiStore } from '@shared/stores/ui.store';
import { env } from '@app/config/env';

export default function SettingsPage() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Workspace preferences and connection details"
        breadcrumb={[{ label: 'Insights' }, { label: 'Settings' }]}
      />

      <SectionCard title="Appearance" description="Theme preference (stored locally)">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Theme</p>
            <p className="text-xs text-muted-foreground">Currently {theme === 'dark' ? 'Dark' : 'Light'}</p>
          </div>
          <Button variant="secondary" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="API Connection" description="How the app reaches the backend">
        <dl className="divide-y divide-border text-sm">
          <Row label="Base URL" value={env.apiBaseUrl} />
          <Row
            label="API key"
            value={
              env.apiKey ? (
                <Badge tone="success">Configured</Badge>
              ) : (
                <Badge tone="neutral">Not set (gate disabled)</Badge>
              )
            }
          />
          <Row label="App" value={env.appName} />
        </dl>
      </SectionCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
