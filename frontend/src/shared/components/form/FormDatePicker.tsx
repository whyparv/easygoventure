import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '@shared/utils/cn';
import { FormFieldWrapper } from './FormFieldWrapper';

interface FormDatePickerProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label?: string;
  required?: boolean;
  className?: string;
  min?: string;
  max?: string;
}

/**
 * Native date input bound to React Hook Form. Swap for a richer date library
 * (e.g. react-day-picker) later without changing the public prop contract.
 */
export function FormDatePicker<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  className,
  min,
  max,
}: FormDatePickerProps<TFieldValues>) {
  const { field, fieldState } = useController({ name, control });

  return (
    <FormFieldWrapper label={label} htmlFor={name} error={fieldState.error?.message} required={required}>
      <input
        {...field}
        id={name}
        type="date"
        min={min}
        max={max}
        value={field.value ?? ''}
        className={cn(
          'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          fieldState.error && 'border-destructive',
          className,
        )}
      />
    </FormFieldWrapper>
  );
}
