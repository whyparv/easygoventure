import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { Drawer } from '@shared/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { Button } from '@shared/components/ui/button';
import { StatusBadge } from '@shared/components/ui/badge';
import { Avatar } from '@shared/components/ui/avatar';
import { Select } from '@shared/components/ui/select';
import { Input } from '@shared/components/ui/input';
import { Skeleton } from '@shared/components/ui/skeleton';
import { EmptyState } from '@shared/components/ui/empty-state';
import { ConfirmDialog } from '@shared/components/ui/confirm-dialog';
import { Timeline } from '@shared/components/data/timeline';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '@shared/components/ui/dropdown';
import { useLead, useLeadActivities } from '@shared/queries/leads.queries';
import { useProposals } from '@shared/queries/proposals.queries';
import { useFollowups } from '@shared/queries/followups.queries';
import { useFulfillments } from '@shared/queries/fulfillments.queries';
import { useUpdateLead, useDeleteLead } from '@shared/mutations/leads.mutations';
import {
  useAcceptProposal,
  useCreateProposal,
  useRejectProposal,
  useSendProposal,
} from '@shared/mutations/proposals.mutations';
import { useCreateFollowup, useUpdateFollowup } from '@shared/mutations/followups.mutations';
import { useUpdateFulfillment } from '@shared/mutations/fulfillments.mutations';
import { LeadOverviewTab } from './LeadOverviewTab';
import { leadDisplayName } from './lead-display';
import {
  FulfillmentStatus,
  LeadStatus,
  ProposalType,
  type Fulfillment,
  type FollowUp,
  type Lead,
  type Proposal,
} from '@shared/types/domain';
import { formatCurrency, formatDate, formatRelative, titleCase } from '@shared/lib/format';
import { fulfillmentTone, leadTone, proposalTone } from '@shared/lib/status';
import { useUiStore } from '@shared/stores/ui.store';
import { useAuthStore } from '@shared/stores/auth.store';

export function LeadDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const open = Boolean(leadId);
  const { data: lead, isLoading } = useLead(leadId ?? undefined);

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={isLoading ? 'Loading…' : lead ? leadDisplayName(lead) : 'Lead'}
      header={lead && <LeadHeader lead={lead} />}
    >
      {isLoading || !lead ? (
        <div className="space-y-3 p-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <LeadDrawerBody lead={lead} onClose={onClose} />
      )}
    </Drawer>
  );
}

function LeadHeader({ lead }: { lead: Lead }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <StatusBadge status={lead.status} tone={leadTone(lead.status)} />
      <span>·</span>
      <span>{titleCase(lead.inquiryType)}</span>
      {lead.companyName && (
        <>
          <span>·</span>
          <span>{lead.companyName}</span>
        </>
      )}
    </div>
  );
}

function LeadDrawerBody({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const canDelete = useAuthStore((s) => s.hasPermission('lead.delete'));
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <LeadAiContextBridge lead={lead} />
      <div className="flex items-center gap-2 border-b border-border px-6 py-3">
        <Avatar name={leadDisplayName(lead)} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" /> {lead.phone}
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3.5" /> {lead.email}
              </a>
            )}
          </div>
        </div>
        <div className="w-40">
          <Select
            value={lead.status}
            options={LeadStatus.map((s) => ({ label: titleCase(s), value: s }))}
            onChange={(e) =>
              updateLead.mutate({ id: lead.id, input: { status: e.target.value as LeadStatus } })
            }
          />
        </div>
        {/* Delete is a manager-level action — hidden for staff without lead.delete. */}
        {canDelete && (
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete lead
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        )}
      </div>

      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
        <div className="px-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {/* Proposal & follow-up workflows are deferred — kept in code, disabled for now. */}
            <TabsTrigger value="proposals" disabled title="Coming soon">
              Proposals · Soon
            </TabsTrigger>
            <TabsTrigger value="followups" disabled title="Coming soon">
              Follow-ups · Soon
            </TabsTrigger>
            <TabsTrigger value="fulfillments">Fulfillments</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <TabsContent value="overview">
            <LeadOverviewTab lead={lead} />
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab leadId={lead.id} />
          </TabsContent>
          <TabsContent value="proposals">
            <ProposalsTab lead={lead} />
          </TabsContent>
          <TabsContent value="followups">
            <FollowupsTab leadId={lead.id} />
          </TabsContent>
          <TabsContent value="fulfillments">
            <FulfillmentsTab leadId={lead.id} />
          </TabsContent>
        </div>
      </Tabs>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this lead?"
        description="It will be soft-deleted. Related proposals and fulfillments are preserved."
        destructive
        confirmLabel="Delete"
        loading={deleteLead.isPending}
        onConfirm={() =>
          deleteLead.mutate(lead.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onClose();
            },
          })
        }
      />
    </div>
  );
}

function TimelineTab({ leadId }: { leadId: string }) {
  const { data, isLoading } = useLeadActivities(leadId);
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.length === 0)
    return <EmptyState title="No activity yet" description="Actions on this lead will appear here." />;
  return <Timeline activities={data} />;
}

function ProposalsTab({ lead }: { lead: Lead }) {
  const { data, isLoading } = useProposals({ leadId: lead.id, limit: 50 });
  const create = useCreateProposal();
  const send = useSendProposal();
  const accept = useAcceptProposal();
  const reject = useRejectProposal();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ProposalType>('VISA');
  const [amount, setAmount] = useState('');

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Proposals ({items.length})</p>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" /> New
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <Input placeholder="Proposal title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as ProposalType)}
              options={ProposalType.map((t) => ({ label: titleCase(t), value: t }))}
            />
            <Input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={create.isPending}
              disabled={title.trim().length < 2}
              onClick={() =>
                create.mutate(
                  {
                    leadId: lead.id,
                    title,
                    proposalType: type,
                    amount: amount ? Number(amount) : undefined,
                  },
                  {
                    onSuccess: () => {
                      setShowForm(false);
                      setTitle('');
                      setAmount('');
                    },
                  },
                )
              }
            >
              Create
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={Send} title="No proposals" description="Create the first proposal for this lead." />
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.generatedToken}</p>
                </div>
                <StatusBadge status={p.status} tone={proposalTone(p.status)} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(p.amount, p.currency)}
                </span>
                <div className="flex gap-1">
                  {p.status === 'DRAFT' && (
                    <Button size="sm" variant="ghost" loading={send.isPending} onClick={() => send.mutate(p.id)}>
                      <Send className="size-3.5" /> Send
                    </Button>
                  )}
                  {(p.status === 'SENT' || p.status === 'VIEWED') && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => accept.mutate(p.id)}>
                        <ThumbsUp className="size-3.5 text-success" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => reject.mutate({ id: p.id })}>
                        <ThumbsDown className="size-3.5 text-danger" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FollowupsTab({ leadId }: { leadId: string }) {
  const { data, isLoading } = useFollowups({ leadId, limit: 50 });
  const create = useCreateFollowup();
  const update = useUpdateFollowup();
  const [date, setDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-sm font-medium text-foreground">Schedule follow-up</p>
        <div className="grid grid-cols-2 gap-2">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            loading={create.isPending}
            disabled={!date}
            onClick={() =>
              create.mutate(
                { leadId, scheduledDate: new Date(date).toISOString(), remarks: remarks || undefined },
                { onSuccess: () => { setDate(''); setRemarks(''); } },
              )
            }
          >
            Schedule
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : items.length === 0 ? (
        <EmptyState title="No follow-ups" />
      ) : (
        <ul className="space-y-2">
          {items.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{f.remarks ?? 'Follow-up'}</p>
                <p className="text-xs text-muted-foreground">{formatRelative(f.scheduledDate)}</p>
              </div>
              {f.completedAt ? (
                <StatusBadge status={f.outcome ?? 'DONE'} tone="success" />
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={update.isPending}
                  onClick={() => update.mutate({ id: f.id, input: { outcome: 'POSITIVE' } })}
                >
                  <CheckCircle2 className="size-3.5" /> Complete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FulfillmentsTab({ leadId }: { leadId: string }) {
  const { data, isLoading } = useFulfillments({ leadId, limit: 50 });
  const update = useUpdateFulfillment();
  const items = data?.items ?? [];

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (items.length === 0)
    return <EmptyState title="No fulfillments" description="A fulfillment opens when a proposal is accepted." />;

  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">{titleCase(f.type)}</p>
            <p className="text-xs text-muted-foreground">Due {formatDate(f.dueDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={f.status} tone={fulfillmentTone(f.status)} />
            <Select
              className="w-40"
              value={f.status}
              options={FulfillmentStatus.map((s) => ({ label: titleCase(s), value: s }))}
              onChange={(e) =>
                update.mutate({ id: f.id, input: { status: e.target.value as never } })
              }
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── AI context bridge ────────────────────────────────────────────────────────

/**
 * While a lead drawer is open, publish a compact summary of the lead and its
 * proposals / follow-ups / fulfillments to the global AI context so the assistant
 * can answer about this actual record. Cleared when the drawer unmounts.
 */
function LeadAiContextBridge({ lead }: { lead: Lead }) {
  const setAiContext = useUiStore((s) => s.setAiContext);
  // Depend on the (stable) React Query data objects, not freshly-allocated arrays.
  const proposals = useProposals({ leadId: lead.id, limit: 50 }).data;
  const followups = useFollowups({ leadId: lead.id, limit: 50 }).data;
  const fulfillments = useFulfillments({ leadId: lead.id, limit: 50 }).data;

  useEffect(() => {
    setAiContext({
      label: lead.companyName ? `${lead.name} · ${lead.companyName}` : lead.name,
      entity: { type: 'lead', id: lead.id },
      text: buildLeadAiContext(
        lead,
        proposals?.items ?? [],
        followups?.items ?? [],
        fulfillments?.items ?? [],
      ),
    });
  }, [lead, proposals, followups, fulfillments, setAiContext]);

  useEffect(() => () => setAiContext(null), [setAiContext]);

  return null;
}

function buildLeadAiContext(
  lead: Lead,
  proposals: Proposal[],
  followups: FollowUp[],
  fulfillments: Fulfillment[],
): string {
  const lines: string[] = [];

  lines.push(`LEAD: ${lead.name}${lead.companyName ? ` (${lead.companyName})` : ''}`);
  lines.push(`- Contact: ${lead.phone}${lead.email ? ` / ${lead.email}` : ''}`);
  lines.push(
    `- Inquiry: ${lead.inquiryType} · Source: ${lead.source} · Status: ${lead.status}`,
  );
  lines.push(`- Created: ${formatDate(lead.createdAt)}`);
  if (lead.rawInquiry) lines.push(`- Original message: "${lead.rawInquiry}"`);
  if (lead.notes) lines.push(`- Notes: ${lead.notes}`);

  lines.push('', `PROPOSALS (${proposals.length}):`);
  if (proposals.length === 0) lines.push('- none yet');
  proposals.forEach((p) =>
    lines.push(
      `- ${p.generatedToken} "${p.title}" · ${p.proposalType} · ` +
        `${formatCurrency(p.amount, p.currency)} · ${p.status}` +
        `${p.expiresAt ? ` · expires ${formatDate(p.expiresAt)}` : ''}`,
    ),
  );

  lines.push('', `FOLLOW-UPS (${followups.length}):`);
  if (followups.length === 0) lines.push('- none yet');
  followups.forEach((f) =>
    lines.push(
      `- ${formatDate(f.scheduledDate)} · ${f.completedAt ? `done (${f.outcome ?? '—'})` : 'pending'}` +
        `${f.remarks ? ` · ${f.remarks}` : ''}${f.nextAction ? ` · next: ${f.nextAction}` : ''}`,
    ),
  );

  lines.push('', `FULFILLMENTS (${fulfillments.length}):`);
  if (fulfillments.length === 0) lines.push('- none yet');
  fulfillments.forEach((ff) =>
    lines.push(
      `- ${ff.type} · ${ff.status}` +
        `${ff.dueDate ? ` · due ${formatDate(ff.dueDate)}` : ''}` +
        `${ff.remarks ? ` · ${ff.remarks}` : ''}`,
    ),
  );

  return lines.join('\n');
}
