import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { KpiTile } from '../../components/KpiTile';
import {
  getDashboardSummary,
  listAccidentRates,
  listCorrectiveActions,
  listSafetyEvents,
  listSites,
  listWorkedHours,
} from '../../lib/api';
import { downloadTextFile, toCsv } from '../../lib/format';
import { t } from '../../lib/i18n/en';

/**
 * Rapports et exports (route `/hse/reports`).
 *
 * Un site n'est compare a un autre que si les heures travaillees des deux
 * sont disponibles ; la methode de calcul est affichee.
 */
export default function ReportsPage() {
  const [siteId, setSiteId] = useState('');

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const { data: summary } = useQuery({
    queryKey: ['dashboard', siteId],
    queryFn: () => getDashboardSummary(siteId || undefined),
    staleTime: 60_000,
  });
  const { data: events } = useQuery({
    queryKey: ['report-events', siteId],
    queryFn: () => listSafetyEvents({ site_id: siteId || undefined }),
    staleTime: 60_000,
  });
  const { data: actions } = useQuery({
    queryKey: ['report-actions', siteId],
    queryFn: () => listCorrectiveActions({ site_id: siteId || undefined }),
    staleTime: 60_000,
  });
  const { data: rates } = useQuery({
    queryKey: ['accident-rates', siteId],
    queryFn: () => listAccidentRates(siteId || undefined),
    staleTime: 60_000,
  });
  const { data: hours } = useQuery({
    queryKey: ['worked-hours', siteId],
    queryFn: () => listWorkedHours(siteId || undefined),
    staleTime: 60_000,
  });

  const exportCsv = () => {
    if (!events) return;
    downloadTextFile(
      'safety-report.csv',
      toCsv(
        events.items.map((e) => ({
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

  const exportJson = () => {
    if (!events) return;
    downloadTextFile(
      'safety-report.json',
      JSON.stringify({ events: events.items, actions: actions?.items ?? [] }, null, 2),
      'application/json',
    );
  };

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>{t('nav.reports')}</h1>
          <p className="sub">Indicators by site, zone, risk type and period.</p>
        </div>
        <div className="head-actions">
          <Button variant="secondary" onClick={exportCsv} disabled={!events || events.items.length === 0}>
            Export CSV
          </Button>
          <Button variant="secondary" onClick={exportJson} disabled={!events || events.items.length === 0}>
            Export JSON
          </Button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="report-site">Site</label>
          <select id="report-site" className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">All sites in scope</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiTile label="Events" value={summary?.total ?? 0} source="computed from safety event logs" />
        <KpiTile label="Closed" value={summary?.closed ?? 0} tone="success" source="computed from safety event logs" />
        <KpiTile
          label="Corrective actions"
          value={actions?.total ?? 0}
          source="computed from corrective actions"
        />
        <KpiTile
          label="Late actions"
          value={summary?.overdueActions ?? 0}
          tone={summary?.overdueActions ? 'late' : 'success'}
          source="computed from corrective actions"
        />
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Accident rate</h2>
        {(rates ?? []).length > 0 ? (
          <>
            <p className="small muted">Calculation method: accidents / hours x 1 000 000</p>
            <div className="table-wrap">
              <table className="data">
                <caption className="visually-hidden">Accident rate by site and period</caption>
                <thead>
                  <tr>
                    <th scope="col">Site</th>
                    <th scope="col">Period</th>
                    <th scope="col">Worked hours</th>
                    <th scope="col">Accidents</th>
                    <th scope="col">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(rates ?? []).map((rate) => {
                    const siteLabel = sites?.find((s) => s.id === rate.site_id)?.name ?? rate.site_id;
                    const hasHours = rate.hours > 0;
                    return (
                      <tr key={`${rate.site_id}-${rate.period_start}`}>
                        <td>{siteLabel}</td>
                        <td>{rate.period_start}</td>
                        <td>{hasHours ? rate.hours : '—'}</td>
                        <td>{rate.accidents}</td>
                        <td>
                          {hasHours
                            ? ((rate.accidents / rate.hours) * 1000000).toFixed(2)
                            : 'Accident rate: not available — worked hours not provided.'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState title="No accident rate available for this selection." />
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Compare sites</h2>
        {(hours ?? []).length > 1 ? (
          <p className="small muted">
            A site can only be compared with another one when the worked hours of both are available.
          </p>
        ) : (
          <p className="small muted">
            Accident rate: not available — worked hours not provided.
          </p>
        )}
      </section>
    </>
  );
}
