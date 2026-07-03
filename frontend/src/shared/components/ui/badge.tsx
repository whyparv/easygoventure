import type { HTMLAttributes } from 'react';
import { cn } from '@shared/utils/cn';
import type { Tone } from '@shared/lib/status';
import { titleCase } from '@shared/lib/format';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground ring-border-strong/60',
  info: 'bg-info/12 text-info-strong ring-info/25',
  success: 'bg-success/12 text-success-strong ring-success/25',
  warning: 'bg-warning/15 text-warning-strong ring-warning/30',
  danger: 'bg-danger/12 text-danger-strong ring-danger/25',
  primary: 'bg-primary/10 text-primary ring-primary/20',
  // Sage green — inquiries. Pink — leads. Dark text keeps WCAG contrast on the soft tints.
  sage: 'bg-secondary/15 text-primary ring-secondary/30',
  pink: 'bg-pink/25 text-foreground ring-pink/45',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ tone = 'neutral', dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Status pill that renders a humanised enum value with the right tone. */
export function StatusBadge({ status, tone }: { status: string; tone: Tone }) {
  return (
    <Badge tone={tone} dot>
      {titleCase(status)}
    </Badge>
  );
}
