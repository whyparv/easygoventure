import { AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Card } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useProposalRisk } from '@shared/queries/operations.queries';
import { riskTone } from '@shared/lib/status';
import { cn } from '@shared/utils/cn';

const RECOMMENDATION: Record<string, string> = {
  MISSING_PASSPORTS: 'Collect passport copies from travelers before submitting visas.',
  UNCONFIRMED_HOTELS: 'Chase supplier confirmation for pending hotel bookings.',
  UNCONFIRMED_TRANSFERS: 'Confirm transfer pickups and assign drivers/vehicles.',
  PENDING_VISAS: 'Escalate visa applications — approvals need the most lead time.',
  MISSING_BOOKING_REFERENCES: 'Add booking/supplier references to confirmed bookings.',
  IMMINENT_TRAVEL_NOT_READY: 'Travel is within 72 hours — resolve all open items now.',
};

export function RiskTab({ proposalId }: { proposalId: string }) {
  const { data, isLoading } = useProposalRisk(proposalId);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) {
    return (
      <Card className="p-6">
        <EmptyState icon={ShieldCheck} title="No risk data" description="Risk is assessed from travelers and bookings." />
      </Card>
    );
  }

  const tone = riskTone(data.level);
  const Icon = data.level === 'LOW' ? ShieldCheck : data.level === 'MEDIUM' ? ShieldAlert : AlertTriangle;
  const bannerBg =
    data.level === 'LOW'
      ? 'border-success/30 bg-success/10'
      : data.level === 'MEDIUM'
        ? 'border-warning/30 bg-warning/10'
        : 'border-danger/30 bg-danger/10';
  const iconColor =
    data.level === 'LOW' ? 'text-success' : data.level === 'MEDIUM' ? 'text-warning' : 'text-danger';

  return (
    <div className="space-y-4">
      <Card className={cn('flex items-center gap-4 border p-4', bannerBg)}>
        <div className={cn('flex size-11 items-center justify-center rounded-xl bg-background', iconColor)}>
          <Icon className="size-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-foreground">{data.level} risk</p>
            <Badge tone={tone}>{data.issues.length} issue(s)</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.hoursToDeparture !== null
              ? data.hoursToDeparture >= 0
                ? `Departure in ~${Math.round(data.hoursToDeparture / 24)} day(s)`
                : 'Departure date has passed'
              : 'No departure date set'}
          </p>
        </div>
      </Card>

      {data.issues.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={ShieldCheck}
            title="Operationally ready"
            description="No open operational risks detected for this proposal."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {data.issues.map((issue) => (
            <Card key={issue.code} className="flex items-start gap-3 p-3.5">
              <span
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                  issue.level === 'HIGH' ? 'bg-danger/10 text-danger' : issue.level === 'MEDIUM' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground',
                )}
              >
                <AlertTriangle className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{issue.message}</p>
                  <Badge tone={riskTone(issue.level)}>{issue.level}</Badge>
                </div>
                {RECOMMENDATION[issue.code] && (
                  <p className="mt-0.5 text-xs text-muted-foreground">→ {RECOMMENDATION[issue.code]}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
