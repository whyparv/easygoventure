import { Check } from 'lucide-react';
import { cn } from '@shared/utils/cn';

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                done && 'border-primary bg-primary text-primary-foreground',
                active && 'border-primary text-primary',
                !done && !active && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                'whitespace-nowrap text-xs font-medium',
                active || done ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <span className={cn('h-px flex-1', done ? 'bg-primary' : 'bg-border')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
