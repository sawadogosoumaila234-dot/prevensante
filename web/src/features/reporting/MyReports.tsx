import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { EventCard } from '../../components/EventCard';
import { ActionCard } from '../../components/ActionCard';
import { EmptyState } from '../../components/EmptyState';
import { listCorrectiveActions, listSafetyEvents } from '../../lib/api';
import { t } from '../../lib/i18n/en';

/**
 * Mes signalements et mes actions (route `/my-reports`).
 */
export default function MyReports() {
  const { user } = useSession();

  const { data: events, isLoading } = useQuery({
    queryKey: ['my-events', user?.id],
    queryFn: () => listSafetyEvents({ reporter_id: user?.id }),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const { data: actions } = useQuery({
    queryKey: ['my-actions', user?.id],
    queryFn: () => listCorrectiveActions({ owner_id: user?.id }),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  return (
    <>
      <div className="page-head">
        <h1>{t('nav.myReports')}</h1>
        <p className="sub">Your reports and the corrective actions assigned to you.</p>
      </div>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Reports</h2>
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : events && events.items.length > 0 ? (
          events.items.map((event) => (
            <EventCard key={event.id} event={event} to={`/my-reports/${event.id}`} />
          ))
        ) : (
          <EmptyState
            title="You have not reported anything yet"
            message="Report a hazard as soon as you observe one."
            action={
              <Link className="btn primary" to="/report">
                {t('nav.report')}
              </Link>
            }
          />
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Corrective actions</h2>
        {actions && actions.items.length > 0 ? (
          actions.items.map((action) => <ActionCard key={action.id} action={action} to={`/hse/actions/${action.id}`} />)
        ) : (
          <EmptyState title={t('empty.actions')} />
        )}
      </section>
    </>
  );
}
