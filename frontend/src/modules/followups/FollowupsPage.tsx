import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { parseISO } from 'date-fns';
import { PageHeader } from '@shared/components/layout/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { Button } from '@shared/components/ui/button';
import { StatusBadge } from '@shared/components/ui/badge';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Card } from '@shared/components/ui/card';
import { useFollowups } from '@shared/queries/followups.queries';
import { useUpdateFollowup } from '@shared/mutations/followups.mutations';
import { formatDateTime, formatRelative } from '@shared/lib/format';
import { outcomeTone } from '@shared/lib/status';
import type { FollowUp } from '@shared/types/domain';

export default function FollowupsPage() {
  const [tab, setTab] = useState('upcoming');
  const completed = tab === 'completed' ? 'true' : 'false';
  const { data, isLoading } = useFollowups({ limit: 100, completed, sortBy: 'scheduledDate', sortOrder: 'asc' });
  const update = useUpdateFollowup();

  const items = useMemo(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) => +parseISO(a.scheduledDate) - +parseISO(b.scheduledDate),
      ),
    [data],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-ups"
        description="Scheduled touch-points with your leads"
        breadcrumb={[{ label: 'Sales' }, { label: 'Follow Ups' }]}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <div className="pt-4">
          <TabsContent value={tab}>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <Card>
                <EmptyState
                  icon={CalendarClock}
                  title={tab === 'upcoming' ? 'No upcoming follow-ups' : 'No completed follow-ups'}
                />
              </Card>
            ) : (
              <ul className="space-y-2">
                {items.map((f) => (
                  <FollowupRow key={f.id} followup={f} onComplete={(id) => update.mutate({ id, input: { outcome: 'POSITIVE' } })} completing={update.isPending} />
                ))}
              </ul>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function FollowupRow({
  followup,
  onComplete,
  completing,
}: {
  followup: FollowUp;
  onComplete: (id: string) => void;
  completing: boolean;
}) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
        <CalendarClock className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{followup.remarks ?? 'Follow-up'}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(followup.scheduledDate)} · {formatRelative(followup.scheduledDate)}
        </p>
        {followup.nextAction && (
          <p className="mt-0.5 text-xs text-muted-foreground">Next: {followup.nextAction}</p>
        )}
      </div>
      {followup.completedAt ? (
        <StatusBadge status={followup.outcome ?? 'DONE'} tone={outcomeTone(followup.outcome ?? '')} />
      ) : (
        <Button size="sm" variant="secondary" loading={completing} onClick={() => onComplete(followup.id)}>
          <CheckCircle2 className="size-3.5" /> Complete
        </Button>
      )}
    </Card>
  );
}
