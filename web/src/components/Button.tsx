import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

/**
 * Bouton du design system (section 13.3).
 * Hauteur minimale 44 px, variante `danger` reservee a la suppression et au
 * rejet motive.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  icon,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', variant, size === 'md' ? '' : size, block ? 'block' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}
