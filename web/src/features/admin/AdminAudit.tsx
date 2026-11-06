import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { FilterBar } from '../../components/FilterBar';
import { listAuditLog, listProfiles } from '../../lib/api';
import { downloadTextFile, toCsv } from '../../lib/format';
import { formatDateTime } from '../../lib/format';
import type { AuditLog } from '../../data/types';

/**
 * Journal d'audit (route `/admin/audit`) : filtre, export CSV.
 */
export default function AdminAudit() {
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');

  const { data: audit, isLoading } = useQuery({ queryKey: ['audit'], queryFn: listAuditLog, staleTime: 60_000 });
  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });

  const rows = useMemo(() => {
    let list = audit ?? [];
    if (actor) list = list.filter((a) => a.actor_id === actor);
    if (action) list = list.filter((a) => a.action === action);
    if (entity) list = list.filter((a) => a.entity_type === entity);
    if (from) list = list.filter((a) => a.created_at >= new Date(from).toISOString());
    return list;
  }, [audit, actor, action, entity, from]);

  const columns: Column<AuditLog>[] = [
    { key: 'created_at', header: 'Date', sortValue: (a) => a.created_at, render: (a) => formatDateTime(a.created_at) },
    {
      key: 'actor',
      header: 'Actor',
      render: (a) =>
        a.actor_id
          ? (profiles?.find((p) => p.id === a.actor_id)?.full_name ?? a.actor_id)
          : a.actor_role ?? 'System',
    },
    { key: 'action', header: 'Action', render: (a) => a.action.replace('_', ' ') },
    { key: 'entity_type', header: 'Entity', render: (a) => a.entity_type },
    { key: 'entity_id', header: 'Entity id', render: (a) => <span className="mono">{a.entity_id ?? '—'}</span> },
  ];

  const actions = useMemo(
    () => [...new Set((audit ?? []).map((a) => a.action))].sort(),
    [audit],
  );
  const entities = useMemo(
    () => [...new Set((audit ?? []).map((a) => a.entity_type))].sort(),
    [audit],
  );

  const exportCsv = () => {
    downloadTextFile(
      'audit-log.csv',
      toCsv(
        rows.map((a) => ({
          created_at: a.created_at,
          actor_id: a.actor_id ?? '',
          actor_role: a.actor_role ?? '',
          action: a.action,
          entity_type: a.entity_type,
          entity_id: a.entity_id ?? '',
        })),
      ),
    );
  };

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Audit log</h1>
          <p className="sub">
            Every change of role, site scope or validated instruction is traced with the
            before/after state.
          </p>
        </div>
        <div className="head-actions">
          <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </Button>
        </div>
      </div>

      <FilterBar
        activeFilters={[
          ...(actor
            ? [{ key: 'actor', label: profiles?.find((p) => p.id === actor)?.full_name ?? actor, onRemove: () => setActor('') }]
            : []),
          ...(action ? [{ key: 'action', label: action.replace('_', ' '), onRemove: () => setAction('') }] : []),
          ...(entity ? [{ key: 'entity', label: entity, onRemove: () => setEntity('') }] : []),
          ...(from ? [{ key: 'from', label: `from ${from}`, onRemove: () => setFrom('') }] : []),
        ]}
        onClearAll={() => {
          setActor('');
          setAction('');
          setEntity('');
          setFrom('');
        }}
      >
        <div className="field">
          <label htmlFor="audit-actor">Actor</label>
          <select id="audit-actor" className="select" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">All actors</option>
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="audit-action">Action</label>
          <select id="audit-action" className="select" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="audit-entity">Entity</label>
          <select id="audit-entity" className="select" value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">All entities</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="audit-from">From date</label>
          <input id="audit-from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
      </FilterBar>

      <section className="panel" style={{ marginTop: 16 }}>
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            keyOf={(a) => a.id}
            emptyTitle="No audit entry matches this filter"
            emptyMessage="Clear the filters to see the whole trail."
            total={rows.length}
          />
        )}
      </section>
    </>
  );
}
