import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { getSafetyDocument, listDocumentVersions, listProfiles } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { SECTOR_LABELS } from '../../lib/i18n/labels';

/**
 * Consigne validee + versions + references (route `/instructions/:id`).
 */
export default function InstructionDetail() {
  const { id } = useParams();

  const { data: document, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => getSafetyDocument(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const { data: versions } = useQuery({
    queryKey: ['document-versions', id],
    queryFn: () => listDocumentVersions(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (!document) {
    return (
      <EmptyState
        title="Instruction not found"
        action={
          <Link className="btn primary" to="/instructions">
            Back to the instruction corpus
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="page-head row">
        <div>
          <h1 style={{ fontSize: 'var(--fs-22)' }}>{document.title}</h1>
          <p className="sub">
            <span className="mono">{document.reference}</span> — version {document.current_version} —{' '}
            {document.sector ? (SECTOR_LABELS[document.sector] ?? document.sector) : 'All sectors'}
          </p>
        </div>
        <div className="head-actions">
          <span className={`badge ${document.status === 'validated' ? 'status-closed' : 'status-submitted'}`}>
            <span className="icon" aria-hidden="true">
              {document.status === 'validated' ? '✔' : '◷'}
            </span>
            {document.status.replace('_', ' ')}
          </span>
          <Button variant="secondary">
            <a href={`/${document.file_path}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              Open PDF
            </a>
          </Button>
        </div>
      </div>

      <section className="panel">
        <dl className="dl-grid">
          <dt>Scope</dt>
          <dd>{document.scope_text}</dd>
          <dt>Current version</dt>
          <dd>{document.current_version}</dd>
          <dt>Validated by</dt>
          <dd>
            {document.validated_by
              ? (profiles?.find((p) => p.id === document.validated_by)?.full_name ?? document.validated_by)
              : 'Not validated yet'}
          </dd>
          <dt>Validated on</dt>
          <dd>{document.validated_at ? formatDate(document.validated_at) : '—'}</dd>
          <dt>Review due</dt>
          <dd>{document.review_due_at ? formatDate(document.review_due_at) : '—'}</dd>
        </dl>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Versions</h2>
        {versions && versions.length > 0 ? (
          versions.map((version) => (
            <div className="card" key={version.id}>
              <div className="row-between">
                <strong>Version {version.version}</strong>
                <span className="small muted">{formatDate(version.created_at)}</span>
              </div>
              <p>{version.change_summary}</p>
              <p className="small muted mono">{version.file_path}</p>
            </div>
          ))
        ) : (
          <EmptyState title="No version history available for this document" />
        )}
      </section>
    </>
  );
}
