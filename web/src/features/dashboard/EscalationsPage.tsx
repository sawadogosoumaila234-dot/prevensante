import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listEscalations, listSafetyEvents, listProfiles } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { KpiTile } from '../../components/KpiTile';
import { formatDateTime } from '../../lib/format';
import { t } from '../../lib/i18n/en';

/**
 * Escalades en cours (route `/hse/escalations`).
 */
export default function EscalationsPage() {
  const { data: escalations, isLoading } = useQuery({
    queryKey: ['escalations-all'],
    queryFn: () => listEscalations(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => listSafetyEvents(),
    staleTime: 60_000,
  });
  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });

  const open = (escalations ?? []).filter((e) => !e.acknowledged_at);
  const acknowledged = (escalations ?? []).filter((e) => e.acknowledged_at);

  return (
    <>
      <div className="page-head">
        <h1>{t('nav.escalations')}</h1>
        <p className="sub">Escalations raised by the triage and the severity rules.</p>
      </div>

      <div className="grid grid-3">
        <KpiTile label="Open escalations" value={open.length} tone={open.length ? 'late' : 'success'} />
        <KpiTile label="Acknowledged" value={acknowledged.length} tone="info" />
        <KpiTile label="Total" value={escalations?.length ?? 0} />
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Open escalations</h2>
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : open.length > 0 ? (
          open.map((esc) => {
            const event = events?.items.find((e) => e.id === esc.event_id);
            const notified = profiles?.find((p) => p.id === esc.notified_user_id);
            return (
              <div className="card" key={esc.id}>
                <div className="row-between">
                  <span className="badge status-escalated">
                    <span className="icon" aria-hidden="true">
                      ⚑
                    </span>
                    {esc.level.replace('_', ' ')}
                  </span>
                  <span className="small muted">{formatDateTime(esc.created_at)}</span>
                </div>
                <p>{esc.reason}</p>
                <p className="small muted">
                  Notified: {notified?.full_name ?? esc.notified_role}
                  {event ? (
                    <>
                      {' — '}
                      <Link to={`/hse/events/${event.id}`} className="mono">
                        {event.reference}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            );
          })
        ) : (
          <EmptyState title="No open escalation" />
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Acknowledged escalations</h2>
        {acknowledged.length > 0 ? (
          acknowledged.map((esc) => (
            <div className="card" key={esc.id}>
              <div className="row-between">
                <strong>{esc.level.replace('_', ' ')}</strong>
                <span className="small muted">{formatDateTime(esc.created_at)}</span>
              </div>
              <p>{esc.reason}</p>
              <p className="small muted">Acknowledged on {formatDateTime(esc.acknowledged_at as string)}</p>
            </div>
          ))
        ) : (
          <EmptyState title="No acknowledged escalation" />
        )}
      </section>
    </>
  );
}
