import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV_SECTIONS } from './nav-config';
import { useUiStore } from '@shared/stores/ui.store';
import { useAuthStore } from '@shared/stores/auth.store';
import { Tooltip } from '@shared/components/ui/tooltip';
import { cn } from '@shared/utils/cn';

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const can = (permission?: string) =>
    !permission ||
    (!!user && (user.isSuperAdmin || user.permissions.includes('*') || user.permissions.includes(permission)));
  // Hide nav items the principal lacks permission for (reactive to the signed-in user).
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 248 }}
      transition={{ type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.22 }}
      className="flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground"
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-pink font-brand text-base font-bold text-pink-foreground">
          E
        </div>
        {!collapsed && (
          <span className="truncate font-brand text-xl font-semibold tracking-wide text-sidebar-foreground">
            EasyGoVenture
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3">
        {sections.map((section, i) => (
          <div key={section.title ?? i} className="space-y-1">
            {section.title && !collapsed && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const content = (
                <>
                  <item.icon className="size-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {!collapsed && !item.enabled && (
                    <span className="ml-auto rounded bg-sidebar-hover px-1.5 py-0.5 text-[9px] font-medium uppercase text-sidebar-muted">
                      Soon
                    </span>
                  )}
                </>
              );
              const base =
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors';

              if (!item.enabled) {
                return (
                  <Tooltip key={item.label} label={collapsed ? `${item.label} (soon)` : ''} side="right">
                    <div
                      className={cn(base, 'cursor-not-allowed text-sidebar-muted/70')}
                      aria-disabled
                    >
                      {content}
                    </div>
                  </Tooltip>
                );
              }
              return (
                <Tooltip key={item.label} label={collapsed ? item.label : ''} side="right">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        base,
                        isActive
                          ? 'bg-sidebar-active font-semibold text-pink-foreground shadow-sm'
                          : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-white',
                      )
                    }
                  >
                    {content}
                  </NavLink>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggle}
        className="flex h-11 items-center gap-2.5 border-t border-sidebar-hover px-4 text-[13px] font-medium text-sidebar-muted transition-colors hover:text-sidebar-active"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </motion.aside>
  );
}
