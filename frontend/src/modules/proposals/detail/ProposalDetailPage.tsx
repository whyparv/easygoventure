import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  Link2,
  MapPin,
  Printer,
  Rocket,
  Users,
} from 'lucide-react';
import { Card } from '@shared/components/ui/card';
import { StatusBadge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Skeleton } from '@shared/components/ui/skeleton';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { ROUTES } from '@app/config/routes';
import { useProposal } from '@shared/queries/proposals.queries';
import { useLead } from '@shared/queries/leads.queries';
import { useAcceptProposal } from '@shared/mutations/proposals.mutations';
import { useBookProposal, useCheckReadiness } from '@shared/mutations/proposals-ops.mutations';
import { bookingLifecycleTone, proposalTone } from '@shared/lib/status';
import { formatCurrency, formatDate } from '@shared/lib/format';
import { CommercialBreakdown } from './CommercialBreakdown';
import { TravelersTab } from './TravelersTab';
import { BookingsTab } from './BookingsTab';
import { TimelineTab } from './TimelineTab';
import { RiskTab } from './RiskTab';
import { DocumentsTab } from './DocumentsTab';
import { PaymentTab } from './PaymentTab';

export default function ProposalDetailPage() {
  const { id = '' } = useParams();
  const { data: proposal, isLoading, isError } = useProposal(id);
  const { data: lead } = useLead(proposal?.leadId ?? undefined);
  const accept = useAcceptProposal();
  const checkReadiness = useCheckReadiness();
  const book = useBookProposal();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !proposal) {
    return (
      <Card className="p-8">
        <EmptyState
          icon={MapPin}
          title="Proposal not found"
          description="This proposal may have been removed or the link is invalid."
          action={
            <Button asChild>
              <Link to={ROUTES.proposals}>Back to proposals</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const snap = proposal.commercialSnapshot;
  const price = proposal.acceptedPrice ?? proposal.amount;
  const bookingStatus = proposal.bookingStatus ?? 'NOT_READY';
  const canAccept = proposal.status === 'SENT' || proposal.status === 'VIEWED';
  const customer = lead?.name ?? 'Customer';

  const copyLink = () => {
    void navigator.clipboard?.writeText(`${window.location.origin}/proposals/${proposal.id}`);
    toast.success('Proposal link copied');
  };

  return (
    <div className="space-y-5">
      <Link
        to={ROUTES.proposals}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All proposals
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{proposal.title}</h1>
            <StatusBadge status={proposal.status} tone={proposalTone(proposal.status)} />
            <StatusBadge status={bookingStatus} tone={bookingLifecycleTone(bookingStatus)} />
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{proposal.generatedToken}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={copyLink}>
            <Link2 /> Copy link
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer /> PDF
          </Button>
          {canAccept && (
            <Button
              size="sm"
              loading={accept.isPending}
              onClick={() => accept.mutate(proposal.id)}
            >
              <CheckCircle2 /> Accept
            </Button>
          )}
          {proposal.status === 'ACCEPTED' && bookingStatus === 'NOT_READY' && (
            <Button
              size="sm"
              loading={checkReadiness.isPending}
              onClick={() => checkReadiness.mutate(proposal.id)}
            >
              Check readiness
            </Button>
          )}
          {bookingStatus === 'READY_FOR_BOOKING' && (
            <Button size="sm" loading={book.isPending} onClick={() => book.mutate(proposal.id)}>
              <Rocket /> Book trip
            </Button>
          )}
        </div>
      </div>

      {/* Hero summary */}
      <Card className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-4">
        <Summary icon={Users} label="Customer" value={customer} sub={lead?.phone} />
        <Summary
          icon={MapPin}
          label="Destination"
          value={snap?.destination ?? proposal.proposalType.replace('_', ' ')}
          sub={snap ? `${snap.numberOfTravelers} traveler(s)` : undefined}
        />
        <Summary
          icon={CalendarRange}
          label="Travel dates"
          value={snap?.travelStartDate ? formatDate(snap.travelStartDate) : 'TBD'}
          sub={snap?.travelEndDate ? `to ${formatDate(snap.travelEndDate)}` : undefined}
        />
        <div className="rounded-lg bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">Total price</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
            {formatCurrency(price, proposal.currency)}
          </p>
          {snap && (
            <p className="text-xs text-success">{formatCurrency(snap.expectedProfit, proposal.currency)} profit</p>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="travelers">Travelers</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
        </TabsList>

        <div className="pt-4">
          <TabsContent value="overview">
            <CommercialBreakdown snapshot={snap} currency={proposal.currency} />
          </TabsContent>
          <TabsContent value="travelers">
            <TravelersTab proposalId={proposal.id} />
          </TabsContent>
          <TabsContent value="bookings">
            <BookingsTab proposalId={proposal.id} />
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab proposalId={proposal.id} />
          </TabsContent>
          <TabsContent value="risk">
            <RiskTab proposalId={proposal.id} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab proposalId={proposal.id} />
          </TabsContent>
          <TabsContent value="payment">
            <PaymentTab
              token={proposal.generatedToken}
              amount={price}
              currency={proposal.currency}
              customer={customer}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium text-foreground">{value}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
