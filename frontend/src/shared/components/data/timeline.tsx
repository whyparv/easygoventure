import {
  Activity,
  CheckCircle2,
  FileText,
  Flag,
  PencilLine,
  PhoneCall,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LeadActivity, LeadActivityType } from '@shared/types/domain';
import { formatRelative } from '@shared/lib/format';
import { cn } from '@shared/utils/cn';

const ICONS: Record<LeadActivityType, { icon: LucideIcon; tone: string }> = {
  LEAD_CREATED: { icon: Plus, tone: 'text-info bg-info/10' },
  LEAD_UPDATED: { icon: PencilLine, tone: 'text-muted-foreground bg-muted' },
  STATUS_CHANGED: { icon: Flag, tone: 'text-primary bg-primary/10' },
  NOTE_ADDED: { icon: PencilLine, tone: 'text-muted-foreground bg-muted' },
  PROPOSAL_CREATED: { icon: FileText, tone: 'text-primary bg-primary/10' },
  PROPOSAL_SENT: { icon: Send, tone: 'text-info bg-info/10' },
  PROPOSAL_VIEWED: { icon: Activity, tone: 'text-info bg-info/10' },
  PROPOSAL_ACCEPTED: { icon: ThumbsUp, tone: 'text-success bg-success/10' },
  PROPOSAL_REJECTED: { icon: ThumbsDown, tone: 'text-danger bg-danger/10' },
  FOLLOW_UP_SCHEDULED: { icon: PhoneCall, tone: 'text-warning bg-warning/10' },
  FOLLOW_UP_COMPLETED: { icon: CheckCircle2, tone: 'text-success bg-success/10' },
  FULFILLMENT_CREATED: { icon: Plus, tone: 'text-primary bg-primary/10' },
  FULFILLMENT_UPDATED: { icon: Activity, tone: 'text-info bg-info/10' },
};

export function Timeline({ activities }: { activities: LeadActivity[] }) {
  return (
    <ol className="relative space-y-1">
      {activities.map((activity, index) => {
        const conf = ICONS[activity.type] ?? { icon: Activity, tone: 'text-muted-foreground bg-muted' };
        const Icon = conf.icon;
        const isLast = index === activities.length - 1;
        return (
          <li key={activity.id} className="relative flex gap-3 pb-4">
            {!isLast && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border" />
            )}
            <span
              className={cn(
                'z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card',
                conf.tone,
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm text-foreground">{activity.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatRelative(activity.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
