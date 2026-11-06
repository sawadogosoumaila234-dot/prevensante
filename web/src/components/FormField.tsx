import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

export interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  /** Compteur de caracteres affiche sous le champ. */
  counter?: { current: number; max: number };
  children: ReactNode;
  htmlFor?: string;
}

/**
 * Champ de formulaire (section 13.3) : label, helper, erreur, compteur de
 * caracteres et attributs `aria` corrects (section 11.7).
 */
export function FormField({
  id,
  label,
  required = false,
  helper,
  error,
  counter,
  children,
  htmlFor,
}: FormFieldProps) {
  const describedBy = [helper ? `${id}-helper` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  const control =
    isValidElement(children) && typeof children.type === 'string'
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          id: htmlFor ?? id,
          'aria-describedby': describedBy || undefined,
          'aria-invalid': error ? true : undefined,
          'aria-required': required || undefined,
        })
      : children;

  return (
    <div className="field">
      <label htmlFor={htmlFor ?? id}>
        {label} {required ? <span className="req" aria-hidden="true">*</span> : null}
      </label>
      {control}
      {helper ? (
        <p className="helper" id={`${id}-helper`}>
          {helper}
        </p>
      ) : null}
      {error ? (
        <p className="error-text" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
      {counter ? (
        <p className="counter" aria-live="polite">
          {counter.current} / {counter.max} characters
        </p>
      ) : null}
    </div>
  );
}
