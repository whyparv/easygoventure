import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@shared/utils/cn';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
}

/** Lightweight native select styled to match the design system. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, placeholder, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-9 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-sm text-foreground shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
);
Select.displayName = 'Select';
