import { Link } from 'react-router-dom';
import { SeverityBadge, StatusBadge } from './Badges';
import { formatDate, isOverdue, overdueDays } from '../lib/format';
import type { CorrectiveAction } from '../data/types';

export interface ActionCardProps {
  action: CorrectiveAction;
  ownerName?: string;
  to?: string;
}

/**
 * Carte d'action corrective (section 13.3) : titre, responsable, echeance
 * avec badge de retard, statut, preuve presente ou absente.
 */
export function ActionCard({ action, ownerName, to }: ActionCardProps) {
  const late = isOverdue(action.due_at) && !['closed', 'cancelled'].includes(action.status);
  const body = (
    <div className={`action-card${late ? ' overdue' : ''}`}>
      <div className="body">
        <div className="row-between">
          <span className="mono">{action.reference}</span>
          <SeverityBadge level={action.severity} />
        </div>
        <p className="title">{action.title}</p>
        <p className="meta">
          {ownerName ?? 'Unassigned'} — due {formatDate(action.due_at)}
          {late ? ` — ${overdueDays(action.due_at)} day(s) late` : ''}
        </p>
        <div className="tags">
          <StatusBadge status={action.status} />
          {late ? <span className="chip overdue">Late</span> : null}
          <span className="chip neutral">
            {action.closure_evidence_path ? 'Closure proof attached' : 'No closure proof'}
          </span>
        </div>
      </div>
    </div>
  );
  if (!to) return body;
  return (
    <Link to={to} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Link>
  );
}
