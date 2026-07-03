import type { TextareaHTMLAttributes } from 'react';
import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '@shared/utils/cn';
import { FormFieldWrapper } from './FormFieldWrapper';

interface FormTextareaProps<TFieldValues extends FieldValues>
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'> {
  name: FieldPath<TFieldValues>;
  control: Control<TFieldValues>;
  label?: string;
}

export function FormTextarea<TFieldValues extends FieldValues>({
  name,
  control,
  label,
  required,
  className,
  rows = 4,
  ...rest
}: FormTextareaProps<TFieldValues>) {
  const { field, fieldState } = useController({ name, control });

  return (
    <FormFieldWrapper label={label} htmlFor={name} error={fieldState.error?.message} required={required}>
      <textarea
        {...field}
        {...rest}
        id={name}
        rows={rows}
        value={field.value ?? ''}
        className={cn(
          'rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          fieldState.error && 'border-destructive',
          className,
        )}
      />
    </FormFieldWrapper>
  );
}
