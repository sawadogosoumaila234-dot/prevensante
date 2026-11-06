import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listEquipments, listRecurrentRisks, listRiskCategories, listSites, listZones } from '../../lib/api';
import { EmptyState } from '../../components/EmptyState';
import { KpiTile } from '../../components/KpiTile';

/**
 * Risques recurrents par site / zone / equipement (route `/hse/recurrences`).
 */
export default function RecurrencesPage() {
  const [siteId, setSiteId] = useState('');

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const { data: risks, isLoading } = useQuery({
    queryKey: ['recurrences', siteId],
    queryFn: () => listRecurrentRisks(siteId || undefined),
    staleTime: 60_000,
  });
  const { data: zones } = useQuery({
    queryKey: ['zones', siteId],
    queryFn: () => listZones(siteId || undefined),
    staleTime: 60_000,
  });
  const { data: equipments } = useQuery({
    queryKey: ['equipments', siteId],
    queryFn: () => listEquipments(siteId || undefined),
    staleTime: 60_000,
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listRiskCategories(),
    staleTime: 60_000,
  });

  const totalOccurrences = (risks ?? []).reduce((s, r) => s + r.occurrences, 0);
  const totalAccidents = (risks ?? []).reduce((s, r) => s + r.accidents, 0);

  return (
    <>
      <div className="page-head">
        <h1>Recurrent risks</h1>
        <p className="sub">
          Events grouped by site, zone, equipment and risk category. A recurrence is a sign that a
          corrective action has not held.
        </p>
      </div>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="recurrence-site">Site</label>
          <select id="recurrence-site" className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">All sites in scope</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-3">
        <KpiTile label="Recurrent risks" value={risks?.length ?? 0} tone={risks?.length ? 'warning' : 'default'} />
        <KpiTile label="Occurrences" value={totalOccurrences} />
        <KpiTile label="Accidents" value={totalAccidents} tone={totalAccidents ? 'late' : 'success'} />
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : (risks ?? []).length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <caption className="visually-hidden">Recurrent risks</caption>
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Zone</th>
                  <th scope="col">Equipment</th>
                  <th scope="col">Risk category</th>
                  <th scope="col">Occurrences</th>
                  <th scope="col">Accidents</th>
                </tr>
              </thead>
              <tbody>
                {(risks ?? []).map((risk) => (
                  <tr key={`${risk.site_id}-${risk.zone_id}-${risk.equipment_id}-${risk.risk_category_id}`}>
                    <td>{sites?.find((s) => s.id === risk.site_id)?.name ?? risk.site_id}</td>
                    <td>{zones?.find((z) => z.id === risk.zone_id)?.name ?? '—'}</td>
                    <td>
                      {risk.equipment_id
                        ? (equipments?.find((e) => e.id === risk.equipment_id)?.name ?? risk.equipment_id)
                        : '—'}
                    </td>
                    <td>
                      {categories?.find((c) => c.id === risk.risk_category_id)?.label ?? '—'}
                    </td>
                    <td>{risk.occurrences}</td>
                    <td>{risk.accidents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No recurrent risk detected"
            message="Each risk is currently reported only once in this scope."
            action={
              <Link className="btn secondary" to="/hse/events">
                Open the event list
              </Link>
            }
          />
        )}
      </section>
    </>
  );
}
