import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from './card';
import { Skeleton } from './skeleton';
import { cn } from '@shared/utils/cn';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  delta?: { value: string; direction: 'up' | 'down' | 'flat' };
  loading?: boolean;
}

export function MetricCard({ label, value, icon: Icon, hint, delta, loading }: MetricCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      )}
      {(hint || delta) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          {delta && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                delta.direction === 'up' && 'text-success',
                delta.direction === 'down' && 'text-danger',
                delta.direction === 'flat' && 'text-muted-foreground',
              )}
            >
              {delta.direction === 'up' && <ArrowUpRight className="size-3" />}
              {delta.direction === 'down' && <ArrowDownRight className="size-3" />}
              {delta.value}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
