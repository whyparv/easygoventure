import {
  BedDouble,
  CalendarClock,
  CheckCircle2,
  Car,
  FileWarning,
  Plane,
  PlaneTakeoff,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageHeader } from '@shared/components/layout/page-header';
import { Card, SectionCard } from '@shared/components/ui/card';
import { MetricCard } from '@shared/components/ui/metric-card';
import { Skeleton } from '@shared/components/ui/skeleton';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Button } from '@shared/components/ui/button';
import { useOperationsDashboard, useRevenuePipeline } from '@shared/queries/operations.queries';
import { formatCurrency } from '@shared/lib/format';
import { cn } from '@shared/utils/cn';
import type { LucideIcon } from 'lucide-react';

function PendingTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: 'warning' | 'info' | 'danger' | 'neutral';
}) {
  const toneMap = {
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
    danger: 'bg-danger/10 text-danger',
    neutral: 'bg-muted text-muted-foreground',
  } as const;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className={cn('flex size-9 items-center justify-center rounded-lg', toneMap[tone])}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function OperationsPage() {
  const { data, isLoading, isError, refetch } = useOperationsDashboard();
  const revenue = useRevenuePipeline();

  const successRate = data ? `${data.bookingSuccessRate}%` : '—';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Operations"
        description="Live command centre for real-world travel execution — departures, bookings, and risk."
      />

      {isError ? (
        <Card className="p-6">
          <EmptyState
            icon={PlaneTakeoff}
            title="Couldn't load operations"
            description="The operations dashboard request failed."
            action={<Button onClick={() => void refetch()}>Retry</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Upcoming departures"
              value={data?.upcomingDepartures ?? 0}
              icon={PlaneTakeoff}
              hint="Next 7 days"
              loading={isLoading}
            />
            <MetricCard
              label="Trips in progress"
              value={data?.tripsInProgress ?? 0}
              icon={CalendarClock}
              loading={isLoading}
            />
            <MetricCard
              label="Completed trips"
              value={data?.completedTrips ?? 0}
              icon={CheckCircle2}
              loading={isLoading}
            />
            <MetricCard
              label="Booking success rate"
              value={successRate}
              icon={TrendingUp}
              hint="Confirmed ÷ active"
              loading={isLoading}
            />
          </div>

          <SectionCard
            title="Pending operational actions"
            description="Supplier confirmations still owed across all active trips."
          >
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <PendingTile icon={BedDouble} label="Pending hotels" value={data?.pendingHotelConfirmations ?? 0} tone="warning" />
                <PendingTile icon={Car} label="Pending transfers" value={data?.pendingTransfers ?? 0} tone="info" />
                <PendingTile icon={Ticket} label="Pending activities" value={data?.pendingActivities ?? 0} tone="neutral" />
                <PendingTile icon={FileWarning} label="Pending visas" value={data?.pendingVisas ?? 0} tone="danger" />
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <PendingTile icon={Users} label="Travelers in transit" value={data?.travelersInTransit ?? 0} tone="info" />
              <PendingTile icon={Plane} label="Booked (awaiting)" value={data?.bookedTrips ?? 0} tone="neutral" />
            </div>
          </SectionCard>

          {!revenue.isError && (
            <SectionCard
              title="Revenue pipeline"
              description="Contractual value from accepted quotations and open pipeline."
            >
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  label="Expected revenue"
                  value={formatCurrency(revenue.data?.expectedRevenue ?? 0)}
                  loading={revenue.isLoading}
                />
                <MetricCard
                  label="Expected profit"
                  value={formatCurrency(revenue.data?.expectedProfit ?? 0)}
                  loading={revenue.isLoading}
                />
                <MetricCard
                  label="Open pipeline"
                  value={formatCurrency(revenue.data?.pipelineRevenue ?? 0)}
                  loading={revenue.isLoading}
                />
                <MetricCard
                  label="Conversion rate"
                  value={`${Math.round((revenue.data?.conversionRate ?? 0) * 100) / 100}%`}
                  loading={revenue.isLoading}
                />
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
