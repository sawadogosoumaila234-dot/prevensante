import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { KpiTile } from '../../components/KpiTile';
import { EventCard } from '../../components/EventCard';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import {
  getDashboardSummary,
  listCorrectiveActions,
  listEscalations,
  listSafetyEvents,
  listSites,
} from '../../lib/api';
import { downloadTextFile, toCsv } from '../../lib/format';
import { t } from '../../lib/i18n/en';

const CAUTION = 'A rise in reports usually means a better reporting culture, not more accidents.';

/**
 * Tableau de bord HSE (route `/hse`) : KPI, retards, recurrences, derniers
 * evenements et escalades ouvertes.
 */
export default function DashboardPage() {
  const { user } = useSession();
  const [siteId, setSiteId] = useState(user?.site_id ?? '');
  const [period, setPeriod] = useState<'30d' | '90d' | 'year' | 'all'>('90d');

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', siteId],
    queryFn: () => getDashboardSummary(siteId || undefined),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: recent } = useQuery({
    queryKey: ['dashboard-events', siteId, period],
    queryFn: () =>
      listSafetyEvents(
        { site_id: siteId || undefined, period },
        null,
        5,
      ),
    staleTime: 60_000,
  });

  const { data: overdue } = useQuery({
    queryKey: ['overdue-actions', siteId],
    queryFn: () => listCorrectiveActions({ site_id: siteId || undefined, overdue: true }, null, 10),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: escalations } = useQuery({
    queryKey: ['escalations-open'],
    queryFn: () => listEscalations(true),
    staleTime: 60_000,
  });

  const exportCsv = () => {
    if (!recent) return;
    downloadTextFile(
      'safety-dashboard.csv',
      toCsv(
        recent.items.map((e) => ({
          reference: e.reference,
          kind: e.kind,
          status: e.status,
          severity: e.severity,
          site_id: e.site_id,
          reported_at: e.reported_at,
        })),
      ),
    );
  };

  const siteName = (id: string | null) => sites?.find((s) => s.id === id)?.name;

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>{t('nav.dashboard')}</h1>
          <p className="sub">Your scope is enforced by the database, not only by the filters.</p>
        </div>
        <div className="head-actions">
          <Button variant="secondary" onClick={exportCsv}>
            {t('action.export')}
          </Button>
        </div>
      </div>

      <div className="notice-strip" role="note">
        {CAUTION}
      </div>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="dashboard-site">Filter by site</label>
          <select id="dashboard-site" className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">All sites in scope</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="dashboard-period">Filter by period</label>
          <select
            id="dashboard-period"
            className="select"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="year">Last 12 months</option>
            <option value="all">All periods</option>
          </select>
        </div>
      </div>

      {isError ? (
        <div className="panel" role="alert">
          <p>The dashboard could not be loaded.</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="grid grid-4">
            <KpiTile
              label="Events recorded"
              value={summary?.total ?? 0}
              delta={`${summary?.open ?? 0} still open`}
              source="computed from safety event logs"
            />
            <KpiTile
              label="Late corrective actions"
              value={summary?.overdueActions ?? 0}
              tone={summary?.overdueActions ? 'late' : 'success'}
              source="computed from corrective actions"
            />
            <KpiTile
              label="Open escalations"
              value={summary?.openEscalations ?? 0}
              tone={summary?.openEscalations ? 'warning' : 'default'}
              source="computed from escalations"
            />
            <KpiTile
              label="Recurrent risks"
              value={summary?.recurrentRisks ?? 0}
              tone={summary?.recurrentRisks ? 'warning' : 'default'}
              source="computed from safety event logs"
            />
          </div>

          <div className="grid grid-2" style={{ marginTop: 24 }}>
            <section className="panel">
              <h2 style={{ fontSize: 'var(--fs-18)' }}>Latest events</h2>
              {recent && recent.items.length > 0 ? (
                recent.items.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    siteName={siteName(event.site_id)}
                    to={`/hse/events/${event.id}`}
                  />
                ))
              ) : (
                <EmptyState title="No safety event has been recorded for this site yet." />
              )}
            </section>

            <section className="panel">
              <h2 style={{ fontSize: 'var(--fs-18)' }}>Late corrective actions</h2>
              {overdue && overdue.items.length > 0 ? (
                <>
                  {overdue.items.map((action) => (
                    <div className="action-card overdue" key={action.id}>
                      <div className="body">
                        <p className="title">{action.title}</p>
                        <p className="meta mono">{action.reference}</p>
                      </div>
                    </div>
                  ))}
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <Link className="btn primary" to="/hse/actions">
                      Open overdue actions
                    </Link>
                  </div>
                </>
              ) : (
                <EmptyState title="No corrective action is late." />
              )}

              <hr className="divider" />
              <h2 style={{ fontSize: 'var(--fs-18)' }}>Open escalations</h2>
              {(escalations ?? []).length > 0 ? (
                (escalations ?? []).map((esc) => (
                  <div className="card" key={esc.id}>
                    <strong>{esc.level.replace('_', ' ')}</strong>
                    <p className="small">{esc.reason}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="No open escalation." />
              )}
            </section>
          </div>
        </>
      )}

      <Alert tone="info">
        A rise in reports usually means a better reporting culture, not more accidents.
      </Alert>
    </>
  );
}
