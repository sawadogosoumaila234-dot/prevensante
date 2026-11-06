import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { listRiskCategories } from '../../lib/api';
import { SECTOR_LABELS } from '../../lib/i18n/labels';
import type { RiskCategory } from '../../data/types';

/**
 * Back-office des categories de risques par secteur (route
 * `/admin/categories`).
 */
export default function AdminCategories() {
  const [sector, setSector] = useState('');

  const { data: categories } = useQuery({
    queryKey: ['categories', sector],
    queryFn: () => listRiskCategories(sector || undefined),
    staleTime: 60_000,
  });

  const columns: Column<RiskCategory>[] = [
    { key: 'code', header: 'Code', sortValue: (c) => c.code, render: (c) => c.code },
    { key: 'label', header: 'Label', render: (c) => c.label },
    { key: 'sector', header: 'Sector', render: (c) => SECTOR_LABELS[c.sector] ?? c.sector },
    { key: 'severity', header: 'Default severity', render: (c) => c.default_severity },
    { key: 'equipment', header: 'Equipment required', render: (c) => (c.requires_equipment ? 'Yes' : 'No') },
    { key: 'active', header: 'Status', render: (c) => (c.is_active ? 'Active' : 'Deactivated') },
  ];

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Risk categories</h1>
          <p className="sub">Referential of risk categories by sector.</p>
        </div>
        <div className="head-actions">
          <Button variant="primary">Add category</Button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="category-sector">Sector</label>
          <select id="category-sector" className="select" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">All sectors</option>
            {Object.entries(SECTOR_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="panel">
        <DataTable
          rows={categories ?? []}
          columns={columns}
          keyOf={(c) => c.id}
          emptyTitle="No risk category for this sector"
          emptyMessage="Add the first category of the sector."
          total={categories?.length ?? 0}
        />
      </section>

      <section className="panel">
        <div className="btn-row">
          <Button variant="secondary">Edit</Button>
          <Button variant="secondary">Deactivate</Button>
        </div>
      </section>
    </>
  );
}
