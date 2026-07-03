import type { SelectHTMLAttributes } from 'react';
import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '@shared/utils/cn';
import { FormFieldWrapper } from './FormFieldWrapper';

export interface SelectOption {
  label: string;
  value: string;
}

interface FormSelectProps<TFieldValues extends FieldValues>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'name'> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function FormSelect<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  options,
  placeholder,
  required,
  className,
  ...rest
}: FormSelectProps<TFieldValues>) {
  const { field, fieldState } = useController({ name, control });

  return (
    <FormFieldWrapper label={label} htmlFor={name} error={fieldState.error?.message} required={required}>
      <select
        {...field}
        {...rest}
        id={name}
        value={field.value ?? ''}
        className={cn(
          'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          fieldState.error && 'border-destructive',
          className,
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormFieldWrapper>
  );
}
