import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format';
import type { SafetyDocument } from '../data/types';

export interface InstructionCardProps {
  document: SafetyDocument;
}

/**
 * Carte de consigne (section 13.3) : reference de document, version, secteur,
 * badge « Validated », lien vers le document.
 */
export function InstructionCard({ document }: InstructionCardProps) {
  return (
    <div className="instruction-card">
      <div className="body">
        <div className="row-between">
          <span className="doc-ref">{document.reference}</span>
          <span className="chip neutral">v{document.current_version}</span>
        </div>
        <p style={{ fontWeight: 700, marginTop: 4 }}>{document.title}</p>
        <p className="small muted">{document.scope_text}</p>
        <div className="tags" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <span className="chip neutral">{document.sector}</span>
          {document.status === 'validated' ? (
            <span className="badge status-closed">
              <span className="icon" aria-hidden="true">
                ✔
              </span>
              Validated
            </span>
          ) : (
            <span className="badge status-submitted">
              <span className="icon" aria-hidden="true">
                ◷
              </span>
              {document.status.replace('_', ' ')}
            </span>
          )}
          {document.review_due_at ? (
            <span className="small muted">Review due {formatDate(document.review_due_at)}</span>
          ) : null}
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Link className="btn secondary sm" to={`/instructions/${document.id}`}>
            Open instruction
          </Link>
          <a className="btn ghost sm" href={`/${document.file_path}`} target="_blank" rel="noreferrer">
            Open PDF
          </a>
        </div>
      </div>
    </div>
  );
}
