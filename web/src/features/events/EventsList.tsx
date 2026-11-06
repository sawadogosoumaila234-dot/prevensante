import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { EventCard } from '../../components/EventCard';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar } from '../../components/FilterBar';
import { Button } from '../../components/Button';
import { listRiskCategories, listSafetyEvents, listSites, listZones, type EventFilters } from '../../lib/api';
import { downloadTextFile, toCsv } from '../../lib/format';
import { t } from '../../lib/i18n/en';
import { kindLabel } from '../../lib/i18n/labels';

const EMPTY_FILTERS: EventFilters = {};

/**
 * Liste des evenements de securite (route `/hse/events`).
 * Filtres complets, pagination par curseur (50 par page), export CSV.
 */
export default function EventsList() {
  const { user } = useSession();
  const [filters, setFilters] = useState<EventFilters>({ ...EMPTY_FILTERS });
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const { data: zones } = useQuery({
    queryKey: ['zones', filters.site_id],
    queryFn: () => listZones(filters.site_id),
    staleTime: 60_000,
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listRiskCategories(),
    staleTime: 60_000,
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['events', filters, cursor],
    queryFn: () => listSafetyEvents(filters, cursor),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const set = (patch: Partial<EventFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setCursor(null);
    setCursorStack([]);
  };

  const siteName = (id: string | null) => sites?.find((s) => s.id === id)?.name;
  const zoneName = (id: string | null) => zones?.find((z) => z.id === id)?.name;

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.kind) chips.push({ key: 'kind', label: kindLabel(filters.kind), onRemove: () => set({ kind: undefined }) });
    if (filters.status) chips.push({ key: 'status', label: filters.status.replace('_', ' '), onRemove: () => set({ status: undefined }) });
    if (filters.severity) chips.push({ key: 'severity', label: filters.severity, onRemove: () => set({ severity: undefined }) });
    if (filters.site_id) chips.push({ key: 'site', label: siteName(filters.site_id) ?? filters.site_id, onRemove: () => set({ site_id: undefined }) });
    if (filters.zone_id) chips.push({ key: 'zone', label: zoneName(filters.zone_id) ?? filters.zone_id, onRemove: () => set({ zone_id: undefined }) });
    if (filters.risk_category_id) {
      const label = categories?.find((c) => c.id === filters.risk_category_id)?.label ?? filters.risk_category_id;
      chips.push({ key: 'category', label, onRemove: () => set({ risk_category_id: undefined }) });
    }
    if (filters.period && filters.period !== 'all') {
      chips.push({ key: 'period', label: filters.period, onRemove: () => set({ period: 'all' }) });
    }
    if (filters.assigned_to) chips.push({ key: 'assigned', label: 'Assigned', onRemove: () => set({ assigned_to: undefined }) });
    if (filters.search) chips.push({ key: 'search', label: `« ${filters.search} »`, onRemove: () => set({ search: undefined }) });
    return chips;
  }, [filters, sites, zones, categories]);

  const exportCsv = () => {
    if (!data) return;
    const rows = data.items.map((e) => ({
      reference: e.reference,
      kind: e.kind,
      status: e.status,
      severity: e.severity,
      site_id: e.site_id,
      zone_id: e.zone_id ?? '',
      occurred_at: e.occurred_at,
      reported_at: e.reported_at,
      activity: e.activity,
      description: e.description,
    }));
    downloadTextFile('safety-events.csv', toCsv(rows));
  };

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>{t('nav.events')}</h1>
          <p className="sub">
            Events in your scope{user?.site_id ? ` (site ${user.site_id})` : ''}. The scope itself is
            enforced by the database, not only by the filters.
          </p>
        </div>
        <div className="head-actions">
          <Button variant="secondary" onClick={exportCsv} disabled={!data || data.items.length === 0}>
            Export CSV
          </Button>
          <Link className="btn primary" to="/hse/events/new">
            New corrective action
          </Link>
        </div>
      </div>

      <FilterBar
        activeFilters={activeFilters}
        onClearAll={() => {
          setFilters({ ...EMPTY_FILTERS });
          setCursor(null);
          setCursorStack([]);
        }}
      >
        <div className="field">
          <label htmlFor="filter-search">Search</label>
          <input
            id="filter-search"
            className="input"
            type="search"
            value={filters.search ?? ''}
            onChange={(e) => set({ search: e.target.value || undefined })}
            placeholder="Description or reference"
          />
        </div>
        <div className="field">
          <label htmlFor="filter-site">Site</label>
          <select
            id="filter-site"
            className="select"
            value={filters.site_id ?? ''}
            onChange={(e) => set({ site_id: e.target.value || undefined, zone_id: undefined })}
          >
            <option value="">All sites</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-zone">Zone</label>
          <select
            id="filter-zone"
            className="select"
            value={filters.zone_id ?? ''}
            onChange={(e) => set({ zone_id: e.target.value || undefined })}
          >
            <option value="">All zones</option>
            {(zones ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-kind">Type</label>
          <select id="filter-kind" className="select" value={filters.kind ?? ''} onChange={(e) => set({ kind: e.target.value || undefined })}>
            <option value="">All types</option>
            <option value="danger">Danger</option>
            <option value="incident">Incident</option>
            <option value="accident">Accident</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-status">Status</label>
          <select id="filter-status" className="select" value={filters.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })}>
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="triaged">Triaged</option>
            <option value="in_progress">In progress</option>
            <option value="awaiting_verification">Awaiting verification</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
            <option value="escalated">Escalated</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-severity">Severity</label>
          <select id="filter-severity" className="select" value={filters.severity ?? ''} onChange={(e) => set({ severity: e.target.value || undefined })}>
            <option value="">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-category">Risk category</label>
          <select
            id="filter-category"
            className="select"
            value={filters.risk_category_id ?? ''}
            onChange={(e) => set({ risk_category_id: e.target.value || undefined })}
          >
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-period">Period</label>
          <select id="filter-period" className="select" value={filters.period ?? 'all'} onChange={(e) => set({ period: e.target.value as EventFilters['period'] })}>
            <option value="all">All periods</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="year">Last 12 months</option>
          </select>
        </div>
      </FilterBar>

      {isError ? (
        <div className="panel" role="alert">
          <p>The events could not be loaded.</p>
          <p className="small muted">{error instanceof Error ? error.message : 'Unknown error.'}</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <p className="muted">Loading…</p>
      ) : data && data.items.length > 0 ? (
        <>
          {data.items.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              siteName={siteName(event.site_id)}
              zoneName={zoneName(event.zone_id)}
              to={`/hse/events/${event.id}`}
            />
          ))}
          <div className="pager">
            <span className="small muted">{data.total} event(s)</span>
            <div className="btn-row">
              <Button
                variant="secondary"
                size="sm"
                disabled={cursorStack.length === 0}
                onClick={() => {
                  const stack = [...cursorStack];
                  const previous = stack.pop() ?? null;
                  setCursorStack(stack);
                  setCursor(previous);
                }}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!data.next_cursor}
                onClick={() => {
                  setCursorStack((s) => [...s, cursor ?? '0']);
                  setCursor(data.next_cursor);
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title={t('empty.events')}
          message="Adjust the filters or clear them to see more."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setFilters({ ...EMPTY_FILTERS });
                setCursor(null);
                setCursorStack([]);
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}
    </>
  );
}
