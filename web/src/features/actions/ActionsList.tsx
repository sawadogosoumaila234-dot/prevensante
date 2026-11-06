import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { ActionCard } from '../../components/ActionCard';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar } from '../../components/FilterBar';
import { Button } from '../../components/Button';
import { listCorrectiveActions, listProfiles, listSites, type ActionFilters } from '../../lib/api';
import { t } from '../../lib/i18n/en';

/**
 * File des actions correctives (route `/hse/actions`) : mes actions ou toutes
 * les actions du perimetre.
 */
export default function ActionsList() {
  const { user } = useSession();
  const [scope, setScope] = useState<'mine' | 'all'>(
    user && ['action_owner', 'maintenance_lead'].includes(user.role) ? 'mine' : 'all',
  );
  const [filters, setFilters] = useState<ActionFilters>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const effective: ActionFilters = {
    ...filters,
    owner_id: scope === 'mine' ? user?.id : filters.owner_id,
  };

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['actions', effective, cursor],
    queryFn: () => listCorrectiveActions(effective, cursor),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const set = (patch: Partial<ActionFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setCursor(null);
    setCursorStack([]);
  };

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.status) chips.push({ key: 'status', label: filters.status.replace('_', ' '), onRemove: () => set({ status: undefined }) });
    if (filters.severity) chips.push({ key: 'severity', label: filters.severity, onRemove: () => set({ severity: undefined }) });
    if (filters.site_id) {
      const label = sites?.find((s) => s.id === filters.site_id)?.name ?? filters.site_id;
      chips.push({ key: 'site', label, onRemove: () => set({ site_id: undefined }) });
    }
    if (filters.overdue) chips.push({ key: 'overdue', label: 'Late only', onRemove: () => set({ overdue: undefined }) });
    if (filters.search) chips.push({ key: 'search', label: `« ${filters.search} »`, onRemove: () => set({ search: undefined }) });
    return chips;
  }, [filters, sites]);

  return (
    <>
      <div className="page-head">
        <h1>{t('nav.actions')}</h1>
        <p className="sub">Corrective actions in your scope.</p>
      </div>

      <div className="tabs" role="tablist" aria-label="Action scope">
        <button type="button" role="tab" aria-selected={scope === 'mine'} onClick={() => setScope('mine')}>
          My actions
        </button>
        <button type="button" role="tab" aria-selected={scope === 'all'} onClick={() => setScope('all')}>
          All actions
        </button>
      </div>

      <FilterBar
        activeFilters={activeFilters}
        onClearAll={() => {
          setFilters({});
          setCursor(null);
          setCursorStack([]);
        }}
      >
        <div className="field">
          <label htmlFor="action-search">Search</label>
          <input
            id="action-search"
            className="input"
            type="search"
            value={filters.search ?? ''}
            onChange={(e) => set({ search: e.target.value || undefined })}
          />
        </div>
        <div className="field">
          <label htmlFor="action-site">Site</label>
          <select
            id="action-site"
            className="select"
            value={filters.site_id ?? ''}
            onChange={(e) => set({ site_id: e.target.value || undefined })}
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
          <label htmlFor="action-status">Status</label>
          <select id="action-status" className="select" value={filters.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })}>
            <option value="">All statuses</option>
            <option value="to_do">To do</option>
            <option value="in_progress">In progress</option>
            <option value="to_verify">To verify</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="action-overdue">Delay</label>
          <select
            id="action-overdue"
            className="select"
            value={filters.overdue ? 'yes' : ''}
            onChange={(e) => set({ overdue: e.target.value === 'yes' ? true : undefined })}
          >
            <option value="">All actions</option>
            <option value="yes">Late actions only</option>
          </select>
        </div>
        {scope === 'all' ? (
          <div className="field">
            <label htmlFor="action-owner">Owner</label>
            <select id="action-owner" className="select" value={filters.owner_id ?? ''} onChange={(e) => set({ owner_id: e.target.value || undefined })}>
              <option value="">All owners</option>
              {(profiles ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </FilterBar>

      {isError ? (
        <div className="panel" role="alert">
          <p>The corrective actions could not be loaded.</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <p className="muted">Loading…</p>
      ) : data && data.items.length > 0 ? (
        <>
          {data.items.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              ownerName={profiles?.find((p) => p.id === action.owner_id)?.full_name}
              to={`/hse/actions/${action.id}`}
            />
          ))}
          <div className="pager">
            <span className="small muted">{data.total} action(s)</span>
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
        <EmptyState title={t('empty.actions')} message="No corrective action matches this scope." />
      )}
    </>
  );
}
