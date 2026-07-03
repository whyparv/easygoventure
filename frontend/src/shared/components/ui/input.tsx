import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@shared/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export function SearchInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-8" {...props} />
    </div>
  );
}
