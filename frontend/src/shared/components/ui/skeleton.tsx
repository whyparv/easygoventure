import type { HTMLAttributes } from 'react';
import { cn } from '@shared/utils/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-black/[0.04] after:to-transparent',
        className,
      )}
      {...props}
    />
  );
}
