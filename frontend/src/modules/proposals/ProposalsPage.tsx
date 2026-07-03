import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { ROUTES } from '@app/config/routes';
import { PageHeader } from '@shared/components/layout/page-header';
import { SearchInput } from '@shared/components/ui/input';
import { Select } from '@shared/components/ui/select';
import { StatusBadge } from '@shared/components/ui/badge';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Pagination } from '@shared/components/ui/pagination';
import { Button } from '@shared/components/ui/button';
import { DataTable, type Column } from '@shared/components/data/data-table';
import { useProposals } from '@shared/queries/proposals.queries';
import { useAcceptProposal, useRejectProposal, useSendProposal } from '@shared/mutations/proposals.mutations';
import { useDebouncedValue } from '@shared/hooks/useDebouncedValue';
import { ProposalStatus, ProposalType, type Proposal } from '@shared/types/domain';
import { formatCurrency, formatDate, titleCase } from '@shared/lib/format';
import { proposalTone } from '@shared/lib/status';

const statusOptions = [{ label: 'All statuses', value: '' }, ...ProposalStatus.map((s) => ({ label: titleCase(s), value: s }))];
const typeOptions = [{ label: 'All types', value: '' }, ...ProposalType.map((s) => ({ label: titleCase(s), value: s }))];

export default function ProposalsPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const navigate = useNavigate();
  const send = useSendProposal();
  const accept = useAcceptProposal();
  const reject = useRejectProposal();

  const query = useMemo(
    () => ({
      page,
      limit: 15,
      search: debounced || undefined,
      status: status || undefined,
      proposalType: type || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc' as const,
    }),
    [page, debounced, status, type],
  );

  const { data, isLoading } = useProposals(query);

  const columns: Column<Proposal>[] = [
    {
      key: 'token',
      header: 'Token',
      render: (p) => <span className="font-mono text-xs text-muted-foreground">{p.generatedToken}</span>,
    },
    {
      key: 'title',
      header: 'Title',
      render: (p) => <span className="font-medium text-foreground">{p.title}</span>,
    },
    { key: 'type', header: 'Type', render: (p) => titleCase(p.proposalType) },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => <span className="font-medium">{formatCurrency(p.amount, p.currency)}</span>,
    },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} tone={proposalTone(p.status)} /> },
    { key: 'created', header: 'Created', align: 'right', render: (p) => <span className="text-muted-foreground">{formatDate(p.createdAt)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {p.status === 'DRAFT' && (
            <Button size="sm" variant="ghost" onClick={() => send.mutate(p.id)}>Send</Button>
          )}
          {(p.status === 'SENT' || p.status === 'VIEWED') && (
            <>
              <Button size="sm" variant="ghost" onClick={() => accept.mutate(p.id)}>Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => reject.mutate({ id: p.id })}>Reject</Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => navigate(ROUTES.proposalDetail(p.id))}>
            View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Proposals"
        description="Quotations across every lead, with their lifecycle status"
        breadcrumb={[{ label: 'Sales' }, { label: 'Proposals' }]}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput className="sm:max-w-xs" placeholder="Search by title…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select className="sm:w-44" options={statusOptions} value={status} onChange={(e) => setStatus(e.target.value)} />
        <Select className="sm:w-40" options={typeOptions} value={type} onChange={(e) => setType(e.target.value)} />
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        getRowId={(p) => p.id}
        loading={isLoading}
        onRowClick={(p) => navigate(ROUTES.proposalDetail(p.id))}
        empty={<EmptyState icon={FileText} title="No proposals" description="Proposals are created from a lead." />}
      />
      {data && data.meta.total > 0 && <Pagination meta={data.meta} onPageChange={setPage} />}
    </div>
  );
}
