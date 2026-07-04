import {
  BedDouble,
  ClipboardList,
  ConciergeBell,
  Gauge,
  LayoutDashboard,
  Receipt,
  Settings,
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

// EasyGo Venture is a focused travel-inquiry workflow, not a generic CRM.
// Inquiries / Proposals / Follow Ups are no longer separate modules — they are
// stages of the single Leads pipeline.
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard, enabled: true },
      { label: 'Leads', to: ROUTES.leads, icon: Users, enabled: true },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Operations', to: ROUTES.operations, icon: Gauge, enabled: true, permission: 'operations.read' },
      { label: 'Fulfillments', to: ROUTES.fulfillments, icon: ClipboardList, enabled: true },
      { label: 'Hotel Catalog', to: ROUTES.hotels, icon: BedDouble, enabled: true },
      { label: 'Services', to: ROUTES.services, icon: ConciergeBell, enabled: true, permission: 'service.read' },
      { label: 'Vouchers', to: ROUTES.vouchers, icon: Ticket, enabled: false },
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
