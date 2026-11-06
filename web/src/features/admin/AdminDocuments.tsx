import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar } from '../../components/FilterBar';
import { InstructionCard } from '../../components/InstructionCard';
import { listSafetyDocuments, listProfiles } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { SECTOR_LABELS } from '../../lib/i18n/labels';

/**
 * Back-office du corpus de consignes (route `/admin/documents`) : versions,
 * validation, archivage.
 *
 * Un document ne peut etre valide que s'il est rattache a un secteur ou a un
 * site : un corpus sans perimetre n'est pas consultable par l'assistant.
 */
export default function AdminDocuments() {
  const [status, setStatus] = useState('');
  const [sector, setSector] = useState('');

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents-admin', status, sector],
    queryFn: () => listSafetyDocuments(status || undefined, sector || undefined),
    staleTime: 60_000,
  });
  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });

  const activeFilters = useMemo(
    () => [
      ...(status ? [{ key: 'status', label: status.replace('_', ' '), onRemove: () => setStatus('') }] : []),
      ...(sector
        ? [{ key: 'sector', label: SECTOR_LABELS[sector] ?? sector, onRemove: () => setSector('') }]
        : []),
    ],
    [status, sector],
  );

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Instruction corpus</h1>
          <p className="sub">Reference, title, sector, current version, status and review date.</p>
        </div>
        <div className="head-actions">
          <Button variant="primary">Upload version</Button>
        </div>
      </div>

      <FilterBar
        activeFilters={activeFilters}
        onClearAll={() => {
          setStatus('');
          setSector('');
        }}
      >
        <div className="field">
          <label htmlFor="doc-status">Status</label>
          <select id="doc-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="in_validation">In validation</option>
            <option value="validated">Validated</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="doc-sector">Sector</label>
          <select id="doc-sector" className="select" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">All sectors</option>
            {Object.entries(SECTOR_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>

      <section className="panel" style={{ marginTop: 16 }}>
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : (documents ?? []).length > 0 ? (
          (documents ?? []).map((document) => (
            <div key={document.id}>
              <InstructionCard document={document} />
              <p className="small muted" style={{ marginTop: 4 }}>
                Validated by{' '}
                {document.validated_by
                  ? (profiles?.find((p) => p.id === document.validated_by)?.full_name ?? document.validated_by)
                  : 'not validated'}{' '}
                — review due {document.review_due_at ? formatDate(document.review_due_at) : 'not set'}
              </p>
            </div>
          ))
        ) : (
          <EmptyState title="No document in the corpus" message="Upload the first version of a safety instruction." />
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Available actions</h2>
        <div className="btn-row">
          <Button variant="secondary">Upload version</Button>
          <Button variant="secondary">Validate version</Button>
          <Button variant="secondary">Archive document</Button>
          <Button variant="secondary">Set review date</Button>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          A document without a sector or a site cannot be validated: a corpus without a scope is not
          consultable by the assistant.
        </p>
      </section>
    </>
  );
}
