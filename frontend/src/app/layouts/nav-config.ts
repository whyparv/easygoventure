import {
  BedDouble,
  Building2,
  CalendarClock,
  ClipboardList,
  Contact,
  FileText,
  Gauge,
  Inbox,
  LayoutDashboard,
  Receipt,
  Settings,
  Sparkles,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@app/config/routes';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Backed by the MVP backend. Unbacked items are shown but disabled. */
  enabled: boolean;
  /** If set, the item is hidden unless the principal holds this permission. */
  permission?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard, enabled: true },
      { label: 'AI Workspace', to: ROUTES.ai, icon: Sparkles, enabled: true },
    ],
  },
  {
    title: 'Pipeline',
    items: [
      { label: 'Inquiries', to: ROUTES.inquiries, icon: Inbox, enabled: true },
      { label: 'Leads', to: ROUTES.leads, icon: Users, enabled: true },
      { label: 'Proposals', to: ROUTES.proposals, icon: FileText, enabled: true },
      { label: 'Follow Ups', to: ROUTES.followups, icon: CalendarClock, enabled: true },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Operations', to: ROUTES.operations, icon: Gauge, enabled: true, permission: 'operations.read' },
      { label: 'Fulfillments', to: ROUTES.fulfillments, icon: ClipboardList, enabled: true },
      { label: 'Hotel Catalog', to: ROUTES.hotels, icon: BedDouble, enabled: true },
      { label: 'Vouchers', to: ROUTES.vouchers, icon: Ticket, enabled: false },
    ],
  },
  {
    title: 'CRM',
    items: [
      { label: 'Agencies', to: ROUTES.agencies, icon: Building2, enabled: false },
      { label: 'Contacts', to: ROUTES.contacts, icon: Contact, enabled: false },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Reports', to: ROUTES.analytics, icon: Receipt, enabled: true, permission: 'report.read' },
      { label: 'Settings', to: ROUTES.settings, icon: Settings, enabled: true },
    ],
  },
];
