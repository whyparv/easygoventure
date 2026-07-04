import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BedDouble,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  Receipt,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Modal } from '@shared/components/ui/modal';
import { useUiStore } from '@shared/stores/ui.store';
import { useLeads } from '@shared/queries/leads.queries';
import { ROUTES } from '@app/config/routes';
import { titleCase } from '@shared/lib/format';
import { cn } from '@shared/utils/cn';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // ⌘K / Ctrl+K toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setOpen]);

  // Live lead search (wired to backend) when there's a query.
  const { data: leadResults } = useLeads({ search: query, limit: 5 });

  const navCommands: Command[] = useMemo(
    () => [
      { id: 'nav-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, run: () => navigate(ROUTES.dashboard) },
      { id: 'nav-leads', label: 'Go to Leads', icon: Users, run: () => navigate(ROUTES.leads) },
      { id: 'nav-operations', label: 'Go to Operations', icon: Gauge, run: () => navigate(ROUTES.operations) },
      { id: 'nav-fulfillments', label: 'Go to Fulfillments', icon: ClipboardList, run: () => navigate(ROUTES.fulfillments) },
      { id: 'nav-hotels', label: 'Go to Hotel Catalog', icon: BedDouble, run: () => navigate(ROUTES.hotels) },
      { id: 'nav-reports', label: 'Go to Reports', icon: Receipt, run: () => navigate(ROUTES.analytics) },
      { id: 'nav-ai', label: 'Open AI Assistant', icon: Sparkles, run: () => useUiStore.getState().setAiOpen(true) },
    ],
    [navigate],
  );

  const filteredNav = navCommands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()),
  );

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const fire = (cmd: () => void) => {
    cmd();
    close();
  };

  return (
    <Modal open={open} onOpenChange={(v) => (v ? setOpen(true) : close())} showClose={false} className="max-w-xl">
      <div className="-mx-6 -my-3">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {query && leadResults && leadResults.items.length > 0 && (
            <Group title="Leads">
              {leadResults.items.map((lead) => (
                <Row
                  key={lead.id}
                  icon={Users}
                  label={lead.name}
                  hint={`${titleCase(lead.inquiryType)} · ${lead.phone}`}
                  onClick={() => fire(() => navigate(`${ROUTES.leads}?lead=${lead.id}`))}
                />
              ))}
            </Group>
          )}
          <Group title="Navigation">
            {filteredNav.map((cmd) => (
              <Row key={cmd.id} icon={cmd.icon} label={cmd.label} onClick={() => fire(cmd.run)} />
            ))}
            {filteredNav.length === 0 && (!leadResults || leadResults.items.length === 0) && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results</p>
            )}
          </Group>
        </div>
      </div>
    </Modal>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
      )}
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="flex-1 truncate text-foreground">{label}</span>
      {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}
