import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@shared/utils/cn';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border border-border bg-card shadow-xs', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export function SectionCard({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </Card>
  );
}
