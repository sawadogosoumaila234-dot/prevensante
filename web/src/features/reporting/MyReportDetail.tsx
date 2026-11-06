import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '../../components/EmptyState';
import { SeverityBadge, StatusBadge } from '../../components/Badges';
import { Timeline, type TimelineEntry } from '../../components/Timeline';
import { ActionCard } from '../../components/ActionCard';
import { getSafetyEvent, listCorrectiveActions, listEventLogs } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { kindLabel } from '../../lib/i18n/labels';

/**
 * Suivi d'un dossier de signalement (route `/my-reports/:id`).
 */
export default function MyReportDetail() {
  const { id } = useParams();

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getSafetyEvent(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const { data: logs } = useQuery({
    queryKey: ['event-logs', id],
    queryFn: () => listEventLogs(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const { data: actions } = useQuery({
    queryKey: ['event-actions', id],
    queryFn: () => listCorrectiveActions({ event_id: id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (!event) {
    return (
      <EmptyState
        title="Report not found"
        message="This report does not exist or is not accessible to you."
        action={
          <Link className="btn primary" to="/my-reports">
            Back to my reports
          </Link>
        }
      />
    );
  }

  const entries: TimelineEntry[] = (logs ?? []).map((log) => ({
    id: log.id,
    title: log.note || log.action.replace('_', ' '),
    detail: log.action.replace('_', ' '),
    at: log.created_at,
    icon: '•',
  }));

  return (
    <>
      <div className="page-head row">
        <div>
          <h1 className="mono" style={{ fontSize: 'var(--fs-22)' }}>
            {event.reference}
          </h1>
          <p className="sub">
            {kindLabel(event.kind)} — reported on {formatDateTime(event.reported_at)}
          </p>
        </div>
        <div className="head-actions">
          <StatusBadge status={event.status} />
          <SeverityBadge level={event.severity} />
        </div>
      </div>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Details</h2>
        <dl className="dl-grid">
          <dt>Activity</dt>
          <dd>{event.activity}</dd>
          <dt>Description</dt>
          <dd>{event.description}</dd>
          <dt>Immediate measures</dt>
          <dd>{event.immediate_measures}</dd>
          <dt>Reported consequences</dt>
          <dd>{event.reported_consequences}</dd>
          <dt>Work stopped</dt>
          <dd>{event.work_stoppage ? 'Yes' : 'No'}</dd>
          <dt>Injury reported</dt>
          <dd>{event.injury_reported ? 'Yes' : 'No'}</dd>
          <dt>Reporter</dt>
          <dd>{event.is_anonymous ? 'Anonymous reporter' : 'You'}</dd>
        </dl>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>History</h2>
        <Timeline entries={entries} />
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Linked corrective actions</h2>
        {actions && actions.items.length > 0 ? (
          actions.items.map((action) => <ActionCard key={action.id} action={action} />)
        ) : (
          <EmptyState title="No corrective action yet" />
        )}
      </section>
    </>
  );
}
