import { CalendarClock } from 'lucide-react';
import { Card } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { EmptyState } from '@shared/components/ui/empty-state';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useTimeline } from '@shared/queries/operations.queries';
import { formatDate } from '@shared/lib/format';
import { cn } from '@shared/utils/cn';
import type { TimelineEvent } from '@shared/types/ops-domain';

const CATEGORY_COLOR: Record<string, string> = {
  HOTEL: 'bg-info',
  TRANSFER: 'bg-primary',
  VISA: 'bg-warning',
  ACTIVITY: 'bg-success',
  FLIGHT: 'bg-foreground',
  VISA_MILESTONE: 'bg-warning',
};

function marker(dateStr: string | null): { label: string; tone: 'success' | 'primary' | 'neutral' } {
  if (!dateStr) return { label: 'Unscheduled', tone: 'neutral' };
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  const dayStart = new Date().setHours(0, 0, 0, 0);
  const dayEnd = dayStart + 86_400_000;
  if (d >= dayStart && d < dayEnd) return { label: 'Today', tone: 'primary' };
  if (d < now) return { label: 'Completed', tone: 'success' };
  return { label: 'Upcoming', tone: 'neutral' };
}

export function TimelineTab({ proposalId }: { proposalId: string }) {
  const { data, isLoading } = useTimeline(proposalId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={CalendarClock}
          title="No itinerary yet"
          description="The timeline is derived automatically from bookings and visa milestones. Add bookings to build it."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge tone="neutral">{data.eventCount} events</Badge>
        {data.start && <span>{formatDate(data.start)}</span>}
        {data.start && data.end && <span>→</span>}
        {data.end && <span>{formatDate(data.end)}</span>}
        <span className="ml-auto">{data.travelerCount} traveler(s)</span>
      </div>

      <ol className="relative space-y-1 pl-6">
        <span className="absolute left-[9px] top-2 bottom-2 w-px bg-border" aria-hidden />
        {data.events.map((e: TimelineEvent, idx) => {
          const m = marker(e.date);
          return (
            <li key={`${e.bookingId}-${idx}`} className="relative">
              <span
                className={cn(
                  'absolute -left-6 top-3 size-[10px] rounded-full ring-4 ring-background',
                  CATEGORY_COLOR[e.category] ?? 'bg-muted-foreground',
                )}
                aria-hidden
              />
              <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{e.title}</p>
                  {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.date ? formatDate(e.date) : 'Date TBD'} · {e.status}
                  </p>
                </div>
                <Badge tone={m.tone}>{m.label}</Badge>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
