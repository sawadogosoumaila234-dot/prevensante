import type { ReactNode } from 'react';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const ALERT_ICONS: Record<AlertTone, string> = {
  info: 'ℹ',
  success: '✔',
  warning: '⚠',
  danger: '⛔',
  neutral: 'ℹ',
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  role?: 'alert' | 'status';
}

/** Bandeau d'information contextuel. */
export function Alert({ tone = 'info', title, children, role = 'status' }: AlertProps) {
  return (
    <div className={`alert ${tone}`} role={role}>
      <span className="alert-icon" aria-hidden="true">
        {ALERT_ICONS[tone]}
      </span>
      <div>
        {title ? <strong>{title}</strong> : null}
        {children}
      </div>
    </div>
  );
}
