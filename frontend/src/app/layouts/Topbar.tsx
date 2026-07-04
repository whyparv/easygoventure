import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, Moon, Plus, Search, Settings, Sparkles, Sun, UserRound } from 'lucide-react';
import { useUiStore } from '@shared/stores/ui.store';
import { useAuthStore } from '@shared/stores/auth.store';
import { authService } from '@shared/services/auth.service';
import { Button } from '@shared/components/ui/button';
import { Tooltip } from '@shared/components/ui/tooltip';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from '@shared/components/ui/dropdown';
import { Avatar } from '@shared/components/ui/avatar';
import { ROUTES } from '@app/config/routes';

function SoonBadge() {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Soon
    </span>
  );
}

export function Topbar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setAiOpen = useUiStore((s) => s.setAiOpen);
  const user = useAuthStore((s) => s.user);
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    : 'Account';

  const signOut = async () => {
    try {
      await authService.logout(useAuthStore.getState().refreshToken);
    } catch {
      /* revoke is best-effort */
    }
    useAuthStore.getState().clearSession();
    qc.clear();
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="group flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground transition-colors hover:border-border-strong"
      >
        <Search className="size-4" />
        <span>Search leads, proposals, tokens…</span>
        <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-border bg-card px-1.5 font-mono text-[10px] text-muted-foreground sm:flex">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Dropdown>
          <DropdownTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>Quick create</DropdownLabel>
            <DropdownItem onSelect={() => navigate(`${ROUTES.leads}?new=1`)}>
              <UserRound /> New lead
            </DropdownItem>
            {/* Proposal & follow-up workflows are deferred — kept, but not yet active. */}
            <DropdownItem disabled className="justify-between">
              <span className="flex items-center gap-2">
                <Plus /> New proposal
              </span>
              <SoonBadge />
            </DropdownItem>
            <DropdownItem disabled className="justify-between">
              <span className="flex items-center gap-2">
                <Plus /> New follow-up
              </span>
              <SoonBadge />
            </DropdownItem>
          </DropdownContent>
        </Dropdown>

        <Tooltip label="AI Assistant">
          <Button variant="ghost" size="icon" onClick={() => setAiOpen(true)} aria-label="AI Assistant">
            <Sparkles className="size-[18px]" />
          </Button>
        </Tooltip>

        <Tooltip label="Notifications">
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
            <Bell className="size-[18px]" />
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-danger" />
          </Button>
        </Tooltip>

        <Tooltip label={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </Button>
        </Tooltip>

        <Dropdown>
          <DropdownTrigger asChild>
            <button className="ml-1 rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar name={displayName} size="md" />
            </button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>{displayName}</DropdownLabel>
            <DropdownItem onSelect={() => navigate(ROUTES.settings)}>
              <Settings /> Settings
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem destructive onSelect={() => void signOut()}>
              <LogOut /> Sign out
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
