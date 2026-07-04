import { useMemo, useState } from 'react';
import { ConciergeBell, Pencil, Plus, Search } from 'lucide-react';
import { PageHeader } from '@shared/components/layout/page-header';
import { Card } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Select } from '@shared/components/ui/select';
import { SearchInput } from '@shared/components/ui/input';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Pagination } from '@shared/components/ui/pagination';
import { DataTable, type Column } from '@shared/components/data/data-table';
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue';
import { useServices, useServiceCategories } from '@shared/queries/services.queries';
import { useAuthStore } from '@shared/stores/auth.store';
import { formatCurrency } from '@shared/lib/format';
import type { Service } from '@shared/types/domain';
import { ServiceEditorModal } from './ServiceEditorModal';

const ACTIVE_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
];

export default function ServicesPage() {
  const canManage = useAuthStore((s) => s.hasPermission('service.create'));
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [destination, setDestination] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Service | null | undefined>(undefined); // undefined=closed, null=create
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: categories } = useServiceCategories();
  const categoryOptions = useMemo(
    () => [
      { label: 'All categories', value: '' },
      ...(categories ?? []).map((c) => ({ label: c.name, value: c.code })),
    ],
    [categories],
  );
  const destinationOptions = useMemo(() => {
    // Destinations are open-ended; derive the filter list from Dubai + whatever exists.
    return [{ label: 'All destinations', value: '' }, { label: 'Dubai', value: 'Dubai' }];
  }, []);

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      sortBy: 'name',
      sortOrder: 'asc' as const,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(category ? { categoryCode: category } : {}),
      ...(destination ? { destination } : {}),
      ...(active ? { isActive: active } : {}),
    }),
    [page, debouncedSearch, category, destination, active],
  );

  const { data, isLoading, isError, refetch } = useServices(params);
  const services = data?.items ?? [];

  const resetPageAnd = (fn: () => void) => {
    setPage(1);
    fn();
  };

  const columns: Column<Service>[] = [
    {
      key: 'name',
      header: 'Service',
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ConciergeBell className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{s.name}</p>
            {s.serviceType && <p className="truncate text-xs text-muted-foreground">{s.serviceType}</p>}
          </div>
        </div>
      ),
    },
    { key: 'categoryCode', header: 'Category', render: (s) => <Badge tone="neutral">{s.categoryCode}</Badge> },
    {
      key: 'variantGroup',
      header: 'Variant group',
      render: (s) => (s.variantGroup ? <Badge tone="info">{s.variantGroup}</Badge> : <span className="text-muted-foreground">—</span>),
    },
    { key: 'destination', header: 'Destination', render: (s) => s.destination },
    { key: 'supplier', header: 'Supplier', render: (s) => s.supplier ?? '—' },
    {
      key: 'defaultSellPrice',
      header: 'Sell',
      align: 'right',
      render: (s) =>
        s.defaultSellPrice != null || s.basePrice != null
          ? formatCurrency(s.defaultSellPrice ?? s.basePrice, s.currency)
          : '—',
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (s) => <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (s: Service) => (
              <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(s)}>
                <Pencil className="size-4" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Services"
        description="Your managed catalog of visas, transfers, activities & more — the source of truth for what you sell."
        breadcrumb={[{ label: 'Operations' }, { label: 'Services' }]}
        actions={
          canManage ? (
            <Button onClick={() => setEditing(null)}>
              <Plus className="size-4" /> Create service
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          className="sm:max-w-xs"
          placeholder="Search name, type, supplier…"
          value={search}
          onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
        />
        <Select
          className="sm:w-44"
          options={categoryOptions}
          value={category}
          onChange={(e) => resetPageAnd(() => setCategory(e.target.value))}
        />
        <Select
          className="sm:w-44"
          options={destinationOptions}
          value={destination}
          onChange={(e) => resetPageAnd(() => setDestination(e.target.value))}
        />
        <Select
          className="sm:w-32"
          options={ACTIVE_OPTIONS}
          value={active}
          onChange={(e) => resetPageAnd(() => setActive(e.target.value))}
        />
      </div>

      {isError ? (
        <Card className="p-6">
          <EmptyState
            icon={Search}
            title="Couldn't load services"
            description="The request failed. Check your connection and try again."
            action={<Button onClick={() => void refetch()}>Retry</Button>}
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <DataTable
              columns={columns}
              rows={services}
              getRowId={(s) => s.id}
              loading={isLoading}
              skeletonRows={8}
              onRowClick={canManage ? (s) => setEditing(s) : undefined}
              empty={
                <EmptyState
                  icon={ConciergeBell}
                  title="No services yet"
                  description={canManage ? 'Create your first service to start building quotes.' : 'No services match your filters.'}
                  action={
                    canManage ? (
                      <Button onClick={() => setEditing(null)}>
                        <Plus className="size-4" /> Create service
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </Card>
          {data && data.meta.total > 0 && <Pagination meta={data.meta} onPageChange={setPage} />}
        </>
      )}

      {editing !== undefined && (
        <ServiceEditorModal
          service={editing}
          categories={categories ?? []}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
