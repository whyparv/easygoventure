import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { PageHeader } from '@shared/components/layout/page-header';
import { Card } from '@shared/components/ui/card';
import { SearchInput } from '@shared/components/ui/input';
import { Select } from '@shared/components/ui/select';
import { StatusBadge } from '@shared/components/ui/badge';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Pagination } from '@shared/components/ui/pagination';
import { Button } from '@shared/components/ui/button';
import { DataTable, type Column } from '@shared/components/data/data-table';
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue';
import { useInquiries } from '@shared/queries/inquiries.queries';
import { inquiryTone } from '@shared/lib/status';
import { formatDate, formatRelative, titleCase } from '@shared/lib/format';
import { InquiryStatus } from '@shared/types/ops-domain';
import type { Inquiry } from '@shared/types/ops-domain';

const STATUS_OPTIONS = [
  { label: 'All statuses', value: '' },
  ...InquiryStatus.map((s) => ({ label: titleCase(s), value: s })),
];

export default function InquiriesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc' as const,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status ? { status } : {}),
    }),
    [page, debouncedSearch, status],
  );

  const { data, isLoading, isError, refetch } = useInquiries(params);
  const rows = data?.items ?? [];

  const columns: Column<Inquiry>[] = [
    {
      key: 'referenceNo',
      header: 'Reference',
      render: (i) => <span className="font-mono text-xs text-muted-foreground">{i.referenceNo}</span>,
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (i) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{i.customerName}</p>
          {i.customerPhone && <p className="truncate text-xs text-muted-foreground">{i.customerPhone}</p>}
        </div>
      ),
    },
    { key: 'destination', header: 'Destination', render: (i) => i.destination ?? '—' },
    {
      key: 'travelers',
      header: 'Pax',
      align: 'right',
      render: (i) => <span className="tabular-nums">{i.travelers ?? '—'}</span>,
    },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} tone={inquiryTone(i.status)} /> },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      align: 'right',
      render: (i) => <span className="text-muted-foreground" title={formatDate(i.createdAt)}>{formatRelative(i.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inquiries"
        description="Inbound demand captured from chat, WhatsApp and the web — the top of the pipeline."
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput
            placeholder="Search inquiries…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Select
          className="w-48"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        />
      </div>

      {isError ? (
        <Card className="p-6">
          <EmptyState
            icon={Inbox}
            title="Couldn't load inquiries"
            description="The request failed."
            action={<Button onClick={() => void refetch()}>Retry</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(i) => i.id}
            loading={isLoading}
            skeletonRows={8}
            empty={
              <EmptyState
                icon={Inbox}
                title="No inquiries yet"
                description="Start a conversation in the AI Assistant to capture your first inquiry."
              />
            }
          />
        </Card>
      )}

      {data && data.meta.total > 0 && <Pagination meta={data.meta} onPageChange={setPage} />}
    </div>
  );
}
