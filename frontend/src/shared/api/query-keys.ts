import type { PaginationParams } from '@shared/types/api';

/** Centralised, typed TanStack Query keys for predictable cache invalidation. */
export const queryKeys = {
  leads: {
    all: ['leads'] as const,
    list: (params: Record<string, unknown>) => ['leads', 'list', params] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
    activities: (id: string) => ['leads', id, 'activities'] as const,
  },
  proposals: {
    all: ['proposals'] as const,
    list: (params: Record<string, unknown>) => ['proposals', 'list', params] as const,
    detail: (id: string) => ['proposals', 'detail', id] as const,
  },
  followups: {
    all: ['followups'] as const,
    list: (params: Record<string, unknown>) => ['followups', 'list', params] as const,
  },
  fulfillments: {
    all: ['fulfillments'] as const,
    list: (params: Record<string, unknown>) => ['fulfillments', 'list', params] as const,
  },
  hotels: {
    all: ['hotels'] as const,
    list: (params: Record<string, unknown>) => ['hotels', 'list', params] as const,
    detail: (id: string) => ['hotels', 'detail', id] as const,
  },
  services: {
    all: ['services'] as const,
    list: (params: Record<string, unknown>) => ['services', 'list', params] as const,
    detail: (id: string) => ['services', 'detail', id] as const,
    categories: ['service-categories'] as const,
  },
  inquiries: {
    all: ['inquiries'] as const,
    list: (params: Record<string, unknown>) => ['inquiries', 'list', params] as const,
    detail: (id: string) => ['inquiries', 'detail', id] as const,
  },
  packages: {
    all: ['packages'] as const,
    list: (params: Record<string, unknown>) => ['packages', 'list', params] as const,
    detail: (id: string) => ['packages', 'detail', id] as const,
    items: (id: string) => ['packages', id, 'items'] as const,
  },
  quotations: {
    all: ['quotations'] as const,
    list: (params: Record<string, unknown>) => ['quotations', 'list', params] as const,
    detail: (id: string) => ['quotations', 'detail', id] as const,
  },
  operations: {
    dashboard: ['operations', 'dashboard'] as const,
    travelers: (proposalId: string) => ['operations', proposalId, 'travelers'] as const,
    bookings: (proposalId: string) => ['operations', proposalId, 'bookings'] as const,
    timeline: (proposalId: string) => ['operations', proposalId, 'timeline'] as const,
    risk: (proposalId: string) => ['operations', proposalId, 'risk'] as const,
    documents: (proposalId: string) => ['operations', proposalId, 'documents'] as const,
  },
  reporting: {
    revenue: ['reporting', 'revenue-pipeline'] as const,
  },
} as const;

export type ListParams = PaginationParams & Record<string, unknown>;
