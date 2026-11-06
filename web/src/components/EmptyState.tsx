import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  action?: ReactNode;
}

/** Etat vide (section 13.3) : illustration simple, message, action principale. */
export function EmptyState({ icon = '⌀', title, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-title">{title}</p>
      {message ? <p>{message}</p> : null}
      {action ? <div className="btn-row" style={{ justifyContent: 'center', marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}
