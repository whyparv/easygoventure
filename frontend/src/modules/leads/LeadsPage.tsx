import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { PageHeader } from '@shared/components/layout/page-header';
import { Button } from '@shared/components/ui/button';
import { SearchInput } from '@shared/components/ui/input';
import { Select } from '@shared/components/ui/select';
import { Avatar } from '@shared/components/ui/avatar';
import { StatusBadge } from '@shared/components/ui/badge';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Pagination } from '@shared/components/ui/pagination';
import { DataTable, type Column } from '@shared/components/data/data-table';
import { useLeads } from '@shared/queries/leads.queries';
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue';
import { InquiryType, LeadStatus, type Lead } from '@shared/types/domain';
import { formatDate, formatRelative, titleCase } from '@shared/lib/format';
import { leadTone } from '@shared/lib/status';
import { LeadCreateDialog } from './LeadCreateDialog';
import { LeadDrawer } from './LeadDrawer';
import { leadDisplayName } from './lead-display';

const statusOptions = [{ label: 'All statuses', value: '' }, ...LeadStatus.map((s) => ({ label: titleCase(s), value: s }))];
const typeOptions = [{ label: 'All types', value: '' }, ...InquiryType.map((s) => ({ label: titleCase(s), value: s }))];

export default function LeadsPage() {
  const params = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('');
  const [inquiryType, setInquiryType] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ by?: string; order: 'asc' | 'desc' }>({
    by: 'createdAt',
    order: 'desc',
  });
  const [createOpen, setCreateOpen] = useState(searchParams.get('new') === '1');

  const activeLeadId = params.id ?? searchParams.get('lead');

  useEffect(() => setPage(1), [debouncedSearch, status, inquiryType]);

  const query = useMemo(
    () => ({
      page,
      limit: 15,
      search: debouncedSearch || undefined,
      status: status || undefined,
      inquiryType: inquiryType || undefined,
      sortBy: sort.by,
      sortOrder: sort.order,
    }),
    [page, debouncedSearch, status, inquiryType, sort],
  );

  const { data, isLoading, isError, error, refetch } = useLeads(query);

  const openLead = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('lead', id);
    next.delete('new');
    setSearchParams(next);
  };
  const closeLead = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('lead');
    setSearchParams(next);
  };

  const toggleSort = (key: string) =>
    setSort((s) => ({ by: key, order: s.by === key && s.order === 'asc' ? 'desc' : 'asc' }));

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (lead) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={leadDisplayName(lead)} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{leadDisplayName(lead)}</p>
            {lead.email && <p className="truncate text-xs text-muted-foreground">{lead.email}</p>}
          </div>
        </div>
      ),
    },
    { key: 'companyName', header: 'Company', render: (l) => l.companyName ?? '—' },
    { key: 'phone', header: 'Phone', render: (l) => <span className="tabular-nums">{l.phone}</span> },
    { key: 'inquiryType', header: 'Inquiry', render: (l) => titleCase(l.inquiryType) },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <StatusBadge status={l.status} tone={leadTone(l.status)} />,
    },
    {
      key: 'updatedAt',
      header: 'Last activity',
      sortable: true,
      render: (l) => <span className="text-muted-foreground">{formatRelative(l.updatedAt)}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      align: 'right',
      render: (l) => <span className="text-muted-foreground">{formatDate(l.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        description="Every inquiry across your travel pipeline"
        breadcrumb={[{ label: 'Lead Management' }, { label: 'Leads' }]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Create lead
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          className="sm:max-w-xs"
          placeholder="Search name, phone, company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select className="sm:w-44" options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value)} />
        <Select className="sm:w-40" options={typeOptions} value={inquiryType} onChange={(e) => setInquiryType(e.target.value)} />
      </div>

      {isError ? (
        <EmptyState
          icon={Users}
          title="Couldn't load leads"
          description={error instanceof Error ? error.message : 'Please try again.'}
          action={<Button variant="secondary" onClick={() => void refetch()}>Retry</Button>}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            getRowId={(l) => l.id}
            loading={isLoading}
            onRowClick={(l) => openLead(l.id)}
            activeRowId={activeLeadId ?? undefined}
            sort={sort}
            onSort={toggleSort}
            empty={
              <EmptyState
                icon={Users}
                title="No leads found"
                description="Adjust your filters or create a new lead."
                action={
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" /> Create lead
                  </Button>
                }
              />
            }
          />
          {data && data.meta.total > 0 && <Pagination meta={data.meta} onPageChange={setPage} />}
        </>
      )}

      <LeadCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={openLead} />
      <LeadDrawer leadId={activeLeadId} onClose={closeLead} />
    </div>
  );
}
