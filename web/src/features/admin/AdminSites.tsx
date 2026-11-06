import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { DataTable, type Column } from '../../components/DataTable';
import { listEquipments, listOrganizations, listSites, listZones } from '../../lib/api';
import { SECTOR_LABELS, ZONE_TYPE_LABELS } from '../../lib/i18n/labels';
import type { Site } from '../../data/types';

/**
 * Back-office des sites, zones et equipements (route `/admin/sites`).
 */
export default function AdminSites() {
  const [tab, setTab] = useState<'sites' | 'zones' | 'equipments'>('sites');

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: () => listZones(), staleTime: 60_000 });
  const { data: equipments } = useQuery({
    queryKey: ['equipments'],
    queryFn: () => listEquipments(),
    staleTime: 60_000,
  });
  const { data: orgs } = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations, staleTime: 60_000 });

  const siteColumns: Column<Site>[] = [
    { key: 'name', header: 'Site', sortValue: (s) => s.name, render: (s) => s.name },
    { key: 'code', header: 'Code', render: (s) => s.code ?? '—' },
    {
      key: 'organization',
      header: 'Organisation',
      render: (s) => orgs?.find((o) => o.id === s.organization_id)?.name ?? '—',
    },
    { key: 'sector', header: 'Sector', render: (s) => SECTOR_LABELS[s.sector] ?? s.sector },
    { key: 'pilot', header: 'Pilot site', render: (s) => (s.is_pilot ? 'Yes' : 'No') },
    { key: 'active', header: 'Status', render: (s) => (s.is_active ? 'Active' : 'Deactivated') },
  ];

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Sites</h1>
          <p className="sub">Sites, zones and equipments of the instance.</p>
        </div>
        <div className="head-actions">
          <Button variant="primary">Add site</Button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Site administration">
        {(['sites', 'zones', 'equipments'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
          >
            {name === 'sites' ? 'Sites' : name === 'zones' ? 'Zones' : 'Equipments'}
          </button>
        ))}
      </div>

      <section className="panel">
        {tab === 'sites' ? (
          <DataTable
            rows={sites ?? []}
            columns={siteColumns}
            keyOf={(s) => s.id}
            emptyTitle="No site yet"
            emptyMessage="Add the first site of the instance."
            total={sites?.length ?? 0}
          />
        ) : null}

        {tab === 'zones' ? (
          (zones ?? []).length > 0 ? (
            <DataTable
              rows={zones ?? []}
              keyOf={(z) => z.id}
              emptyTitle="No zone yet"
              total={zones?.length ?? 0}
              columns={[
                { key: 'name', header: 'Zone', render: (z) => z.name },
                { key: 'type', header: 'Type', render: (z) => ZONE_TYPE_LABELS[z.type] ?? z.type },
                {
                  key: 'site',
                  header: 'Site',
                  render: (z) => sites?.find((s) => s.id === z.site_id)?.name ?? z.site_id,
                },
                { key: 'code', header: 'Code', render: (z) => z.code ?? '—' },
              ]}
            />
          ) : (
            <EmptyState title="No zone yet" />
          )
        ) : null}

        {tab === 'equipments' ? (
          (equipments ?? []).length > 0 ? (
            <DataTable
              rows={equipments ?? []}
              keyOf={(e) => e.id}
              emptyTitle="No equipment yet"
              total={equipments?.length ?? 0}
              columns={[
                { key: 'name', header: 'Equipment', render: (e) => e.name },
                { key: 'asset', header: 'Asset code', render: (e) => e.asset_code ?? '—' },
                { key: 'type', header: 'Type', render: (e) => e.equipment_type ?? '—' },
                {
                  key: 'site',
                  header: 'Site',
                  render: (e) => sites?.find((s) => s.id === e.site_id)?.name ?? e.site_id,
                },
                { key: 'critical', header: 'Critical', render: (e) => (e.is_critical ? 'Yes' : 'No') },
              ]}
            />
          ) : (
            <EmptyState title="No equipment yet" />
          )
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Available actions</h2>
        <div className="btn-row">
          <Button variant="secondary">Add zone</Button>
          <Button variant="secondary">Add equipment</Button>
          <Button variant="secondary">Edit</Button>
          <Button variant="secondary">Set as pilot site</Button>
          <Button variant="secondary">Activate</Button>
          <Button variant="secondary">Deactivate</Button>
        </div>
      </section>
    </>
  );
}
