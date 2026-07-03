import { useMemo, useState } from 'react';
import { Columns3, ClipboardList, Table2 } from 'lucide-react';
import { PageHeader } from '@shared/components/layout/page-header';
import { Button } from '@shared/components/ui/button';
import { StatusBadge } from '@shared/components/ui/badge';
import { Select } from '@shared/components/ui/select';
import { Skeleton } from '@shared/components/ui/skeleton';
import { EmptyState } from '@shared/components/ui/empty-state';
import { DataTable, type Column } from '@shared/components/data/data-table';
import { useFulfillments } from '@shared/queries/fulfillments.queries';
import { useUpdateFulfillment } from '@shared/mutations/fulfillments.mutations';
import { FulfillmentStatus, type Fulfillment } from '@shared/types/domain';
import { formatDate, titleCase } from '@shared/lib/format';
import { fulfillmentTone } from '@shared/lib/status';
import { cn } from '@shared/utils/cn';

const COLUMNS = FulfillmentStatus;

export default function FulfillmentsPage() {
  const [view, setView] = useState<'board' | 'table'>('board');
  const { data, isLoading } = useFulfillments({ limit: 100, sortBy: 'createdAt', sortOrder: 'desc' });
  const update = useUpdateFulfillment();
  const items = useMemo(() => data?.items ?? [], [data]);

  const grouped = useMemo(() => {
    const map: Record<string, Fulfillment[]> = {};
    for (const status of COLUMNS) map[status] = [];
    for (const f of items) (map[f.status] ??= []).push(f);
    return map;
  }, [items]);

  const move = (f: Fulfillment, status: string) =>
    update.mutate({ id: f.id, input: { status: status as Fulfillment['status'] } });

  const tableColumns: Column<Fulfillment>[] = [
    { key: 'type', header: 'Type', render: (f) => <span className="font-medium text-foreground">{titleCase(f.type)}</span> },
    { key: 'status', header: 'Status', render: (f) => <StatusBadge status={f.status} tone={fulfillmentTone(f.status)} /> },
    { key: 'remarks', header: 'Remarks', render: (f) => f.remarks ?? '—' },
    { key: 'due', header: 'Due', render: (f) => formatDate(f.dueDate) },
    {
      key: 'move',
      header: 'Move to',
      align: 'right',
      render: (f) => (
        <Select
          className="w-44"
          value={f.status}
          options={COLUMNS.map((s) => ({ label: titleCase(s), value: s }))}
          onChange={(e) => move(f, e.target.value)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fulfillments"
        description="Post-acceptance operations — visas, bookings, transfers"
        breadcrumb={[{ label: 'Operations' }, { label: 'Fulfillments' }]}
        actions={
          <div className="flex rounded-md border border-border p-0.5">
            <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('board')}>
              <Columns3 className="size-4" /> Board
            </Button>
            <Button variant={view === 'table' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('table')}>
              <Table2 className="size-4" /> Table
            </Button>
          </div>
        }
      />

      {view === 'table' ? (
        <DataTable
          columns={tableColumns}
          rows={items}
          getRowId={(f) => f.id}
          loading={isLoading}
          empty={<EmptyState icon={ClipboardList} title="No fulfillments yet" />}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((s) => (
            <Skeleton key={s} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((status) => (
            <div key={status} className="flex flex-col rounded-lg border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <StatusBadge status={status} tone={fulfillmentTone(status)} />
                <span className="text-xs font-medium text-muted-foreground">{grouped[status]?.length ?? 0}</span>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {(grouped[status] ?? []).map((f) => (
                  <div key={f.id} className="rounded-md border border-border bg-card p-3 shadow-xs">
                    <p className="text-sm font-medium text-foreground">{titleCase(f.type)}</p>
                    {f.remarks && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{f.remarks}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{formatDate(f.dueDate)}</span>
                      <Select
                        className={cn('h-7 w-28 text-xs')}
                        value={f.status}
                        options={COLUMNS.map((s) => ({ label: titleCase(s), value: s }))}
                        onChange={(e) => move(f, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                {(grouped[status] ?? []).length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
