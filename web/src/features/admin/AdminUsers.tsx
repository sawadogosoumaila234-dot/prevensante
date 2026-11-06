import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column } from '../../components/DataTable';
import { FilterBar } from '../../components/FilterBar';
import { Button } from '../../components/Button';
import { listOrganizations, listProfiles, listSites } from '../../lib/api';
import { downloadTextFile, toCsv } from '../../lib/format';
import { ROLE_LABELS } from '../../lib/i18n/labels';
import type { Profile } from '../../data/types';

/**
 * Back-office des comptes (route `/admin/users`).
 *
 * Toute mutation de role, de site ou d'habilitation medicale est tracee
 * dans `audit_log` avec l'avant/apres.
 */
export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [siteId, setSiteId] = useState('');

  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const { data: orgs } = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations, staleTime: 60_000 });

  const rows = useMemo(() => {
    let list = profiles ?? [];
    if (role) list = list.filter((p) => p.role === role);
    if (siteId) list = list.filter((p) => p.site_id === siteId);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (p) => p.full_name.toLowerCase().includes(s) || (p.email ?? '').toLowerCase().includes(s),
      );
    }
    return list;
  }, [profiles, role, siteId, search]);

  const columns: Column<Profile>[] = [
    { key: 'full_name', header: 'Name', sortValue: (p) => p.full_name, render: (p) => p.full_name },
    { key: 'email', header: 'Email', render: (p) => p.email ?? '—' },
    { key: 'role', header: 'Role', sortValue: (p) => p.role, render: (p) => ROLE_LABELS[p.role] },
    {
      key: 'site',
      header: 'Site',
      render: (p) => sites?.find((s) => s.id === p.site_id)?.name ?? 'All sites',
    },
    {
      key: 'organization',
      header: 'Organisation',
      render: (p) => orgs?.find((o) => o.id === p.organization_id)?.name ?? '—',
    },
    {
      key: 'medical',
      header: 'Medical authorization',
      render: (p) => (p.is_medical_authorized ? 'Authorized' : 'Not authorized'),
    },
    { key: 'active', header: 'Status', render: (p) => (p.is_active ? 'Active' : 'Deactivated') },
  ];

  const exportCsv = () => {
    downloadTextFile(
      'admin-users.csv',
      toCsv(
        rows.map((p) => ({
          full_name: p.full_name,
          email: p.email ?? '',
          role: p.role,
          site_id: p.site_id ?? '',
          organization_id: p.organization_id ?? '',
          is_medical_authorized: p.is_medical_authorized,
          is_active: p.is_active,
        })),
      ),
    );
  };

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Accounts</h1>
          <p className="sub">Name, email, role, site, organisation and medical authorization.</p>
        </div>
        <div className="head-actions">
          <Button variant="primary">Invite user</Button>
        </div>
      </div>

      <FilterBar
        activeFilters={[
          ...(role ? [{ key: 'role', label: ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role, onRemove: () => setRole('') }] : []),
          ...(siteId
            ? [{ key: 'site', label: sites?.find((s) => s.id === siteId)?.name ?? siteId, onRemove: () => setSiteId('') }]
            : []),
          ...(search ? [{ key: 'search', label: `« ${search} »`, onRemove: () => setSearch('') }] : []),
        ]}
        onClearAll={() => {
          setSearch('');
          setRole('');
          setSiteId('');
        }}
      >
        <div className="field">
          <label htmlFor="admin-user-search">Search</label>
          <input
            id="admin-user-search"
            className="input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="admin-user-role">Role</label>
          <select id="admin-user-role" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="admin-user-site">Site</label>
          <select id="admin-user-site" className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">All sites</option>
            {(sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>

      <section className="panel" style={{ marginTop: 16 }}>
        <DataTable
          rows={rows}
          columns={columns}
          keyOf={(p) => p.id}
          emptyTitle="No account matches this selection"
          emptyMessage="Invite a user or clear the filters."
          total={rows.length}
          exportCsv={exportCsv}
        />
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Available actions</h2>
        <div className="btn-row">
          <Button variant="secondary">Change role</Button>
          <Button variant="secondary">Set site scope</Button>
          <Button variant="secondary">Toggle medical authorization</Button>
          <Button variant="secondary">Deactivate</Button>
          <Button variant="secondary">Reactivate</Button>
          <Button variant="secondary">Resend invitation</Button>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          An administrator cannot validate a corrective action in place of the HSE officer unless the
          account is also authorized as an HSE officer on the site.
        </p>
      </section>
    </>
  );
}
