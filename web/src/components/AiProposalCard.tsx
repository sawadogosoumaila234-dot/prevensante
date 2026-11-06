import { Button } from './Button';
import { t } from '../lib/i18n/en';
import type { AiProposal } from '../data/types';

export interface AiProposalCardProps {
  proposal: AiProposal;
  categoryLabel?: string;
  documentTitle?: string;
  busy?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}

/**
 * Proposition IA (section 13.3) : proposition, confiance, rationale, limites,
 * boutons Accept / Reject. Une proposition n'est jamais appliquee
 * automatiquement (CR06).
 */
export function AiProposalCard({
  proposal,
  categoryLabel,
  documentTitle,
  busy = false,
  onAccept,
  onReject,
}: AiProposalCardProps) {
  const pending = proposal.status === 'pending_review';
  return (
    <article className="ai-proposal">
      <div className="row-between">
        <div>
          <p style={{ fontWeight: 700 }}>
            {proposal.proposal_type === 'classification'
              ? 'Suggested classification'
              : 'Suggested instruction'}
          </p>
          <p className="small muted">
            Confidence{' '}
            <span className="confidence">{Math.round((proposal.confidence ?? 0) * 100)}%</span> —{' '}
            {proposal.model_name}
          </p>
        </div>
        <span className={`badge ${proposal.status === 'accepted' ? 'status-closed' : proposal.status === 'rejected' ? 'status-rejected' : 'status-submitted'}`}>
          <span className="icon" aria-hidden="true">
            {proposal.status === 'accepted' ? '✔' : proposal.status === 'rejected' ? '✖' : '◷'}
          </span>
          {proposal.status.replace('_', ' ')}
        </span>
      </div>

      {categoryLabel ? (
        <p style={{ marginTop: 12 }}>
          <strong>Category:</strong> {categoryLabel}
          {proposal.suggested_severity ? ` — severity ${proposal.suggested_severity}` : ''}
        </p>
      ) : null}
      {documentTitle ? (
        <p>
          <strong>Instruction:</strong> {documentTitle}
        </p>
      ) : null}

      {proposal.rationale ? <p className="limits">{proposal.rationale}</p> : null}
      {proposal.limitations ? <p className="limits">{proposal.limitations}</p> : null}

      {proposal.references.length > 0 ? (
        <p className="small muted">References: {proposal.references.join(', ')}</p>
      ) : null}

      {pending && (onAccept || onReject) ? (
        <div className="btn-row" style={{ marginTop: 16 }}>
          {onAccept ? (
            <Button variant="primary" onClick={onAccept} loading={busy}>
              {t('action.acceptProposal')}
            </Button>
          ) : null}
          {onReject ? (
            <Button variant="danger" onClick={onReject} loading={busy}>
              {t('action.rejectProposal')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {proposal.review_note ? (
        <p className="small muted" style={{ marginTop: 12 }}>
          Review note: {proposal.review_note}
        </p>
      ) : null}
    </article>
  );
}
