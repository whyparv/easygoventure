import type { ReactNode } from 'react';
import { cn } from '@shared/utils/cn';

interface FormFieldWrapperProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Shared label + error chrome for all form controls.
 */
export function FormFieldWrapper({
  label,
  htmlFor,
  error,
  required,
  className,
  children,
}: FormFieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
