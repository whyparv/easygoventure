import type { InputHTMLAttributes } from 'react';
import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '@shared/utils/cn';
import { FormFieldWrapper } from './FormFieldWrapper';

interface FormInputProps<TFieldValues extends FieldValues>
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label?: string;
}

/**
 * Controlled text input bound to React Hook Form.
 */
export function FormInput<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  className,
  ...rest
}: FormInputProps<TFieldValues>) {
  const { field, fieldState } = useController({ name, control });

  return (
    <FormFieldWrapper label={label} htmlFor={name} error={fieldState.error?.message} required={required}>
      <input
        {...field}
        {...rest}
        id={name}
        value={field.value ?? ''}
        className={cn(
          'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          fieldState.error && 'border-destructive',
          className,
        )}
      />
    </FormFieldWrapper>
  );
}
