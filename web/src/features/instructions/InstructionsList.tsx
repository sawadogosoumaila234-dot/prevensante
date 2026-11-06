import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InstructionCard } from '../../components/InstructionCard';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar } from '../../components/FilterBar';
import { Button } from '../../components/Button';
import { listSafetyDocuments } from '../../lib/api';
import { t } from '../../lib/i18n/en';
import { SECTOR_LABELS } from '../../lib/i18n/labels';

/**
 * Corpus des consignes validees (route `/instructions`) : recherche par
 * secteur, titre et reference.
 */
export default function InstructionsList() {
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState('');
  const [status, setStatus] = useState('validated');

  const { data, isLoading } = useQuery({
    queryKey: ['documents', status, sector],
    queryFn: () => listSafetyDocuments(status || undefined, sector || undefined),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter(
      (d) =>
        d.title.toLowerCase().includes(s) ||
        d.reference.toLowerCase().includes(s) ||
        (d.scope_text ?? '').toLowerCase().includes(s),
    );
  }, [data, search]);

  return (
    <>
      <div className="page-head">
        <h1>{t('nav.instructions')}</h1>
        <p className="sub">
          Validated instructions for your sector. Safety instructions are not translated: they stay
          in the language of their source document.
        </p>
      </div>

      <FilterBar
        activeFilters={[
          ...(sector ? [{ key: 'sector', label: SECTOR_LABELS[sector] ?? sector, onRemove: () => setSector('') }] : []),
          ...(status !== 'validated'
            ? [{ key: 'status', label: status, onRemove: () => setStatus('validated') }]
            : []),
          ...(search ? [{ key: 'search', label: `« ${search} »`, onRemove: () => setSearch('') }] : []),
        ]}
        onClearAll={() => {
          setSearch('');
          setSector('');
          setStatus('validated');
        }}
      >
        <div className="field">
          <label htmlFor="instruction-search">Search</label>
          <input
            id="instruction-search"
            className="input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, reference or scope"
          />
        </div>
        <div className="field">
          <label htmlFor="instruction-sector">Sector</label>
          <select id="instruction-sector" className="select" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">All sectors</option>
            {Object.entries(SECTOR_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="instruction-status">Status</label>
          <select id="instruction-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="validated">Validated</option>
            <option value="in_validation">In validation</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
            <option value="">All statuses</option>
          </select>
        </div>
      </FilterBar>

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : filtered.length > 0 ? (
        filtered.map((document) => <InstructionCard key={document.id} document={document} />)
      ) : (
        <EmptyState
          title={t('empty.instructions')}
          message="Try another sector or clear the search."
          action={
            <Button variant="secondary" onClick={() => { setSearch(''); setSector(''); setStatus('validated'); }}>
              Clear filters
            </Button>
          }
        />
      )}
    </>
  );
}
