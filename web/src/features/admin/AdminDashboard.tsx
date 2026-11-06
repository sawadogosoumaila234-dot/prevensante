import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { KpiTile } from '../../components/KpiTile';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import {
  listAuditLog,
  listEmailOutbox,
  listOrganizations,
  listProfiles,
  listSafetyDocuments,
  listSafetyEvents,
  listSites,
  listSmsOutbox,
} from '../../lib/api';
import { formatDateTime } from '../../lib/format';

/**
 * Tableau de bord administrateur (route `/admin`).
 *
 * Le back-office est separe du front metier par une garde de role
 * `admin` (section 12).
 */
export default function AdminDashboard() {
  const { data: orgs } = useQuery({ queryKey: ['organizations'], queryFn: listOrganizations, staleTime: 60_000 });
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });
  const { data: events } = useQuery({ queryKey: ['events'], queryFn: () => listSafetyEvents(), staleTime: 60_000 });
  const { data: documents } = useQuery({
    queryKey: ['documents-validated'],
    queryFn: () => listSafetyDocuments('validated'),
    staleTime: 60_000,
  });
  const { data: audit } = useQuery({ queryKey: ['audit'], queryFn: listAuditLog, staleTime: 60_000 });
  const { data: emails } = useQuery({ queryKey: ['email-outbox'], queryFn: listEmailOutbox, staleTime: 60_000 });
  const { data: sms } = useQuery({ queryKey: ['sms-outbox'], queryFn: listSmsOutbox, staleTime: 60_000 });

  const failedEmails = (emails ?? []).filter((e) => e.status === 'failed').length;
  const failedSms = (sms ?? []).filter((s) => s.status === 'failed').length;

  return (
    <>
      <div className="page-head">
        <h1>Administration</h1>
        <p className="sub">
          Accounts, sites, referentials, instruction corpus, audit trail and message outbox.
        </p>
      </div>

      <div className="grid grid-4">
        <KpiTile label="Organisations" value={orgs?.length ?? 0} />
        <KpiTile label="Sites" value={sites?.length ?? 0} />
        <KpiTile label="Accounts" value={profiles?.length ?? 0} />
        <KpiTile label="Safety events" value={events?.total ?? 0} />
      </div>

      <div className="grid grid-3" style={{ marginTop: 24 }}>
        <section className="panel">
          <h2 style={{ fontSize: 'var(--fs-18)' }}>Validated instructions</h2>
          <p className="small muted">{documents?.length ?? 0} validated document(s) available to the assistant.</p>
          <div className="btn-row">
            <Link className="btn secondary" to="/admin/documents">
              Manage the corpus
            </Link>
          </div>
        </section>

        <section className="panel">
          <h2 style={{ fontSize: 'var(--fs-18)' }}>Message outbox</h2>
          <p className="small muted">
            {failedEmails + failedSms > 0
              ? `${failedEmails + failedSms} failed message(s) need attention.`
              : 'No failed message.'}
          </p>
          <div className="btn-row">
            <Link className="btn secondary" to="/admin/outbox">
              Open the outbox
            </Link>
          </div>
        </section>

        <section className="panel">
          <h2 style={{ fontSize: 'var(--fs-18)' }}>Audit trail</h2>
          <p className="small muted">{(audit ?? []).length} traced operation(s).</p>
          <div className="btn-row">
            <Link className="btn secondary" to="/admin/audit">
              Open the audit log
            </Link>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Latest audit entries</h2>
        {(audit ?? []).length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <caption className="visually-hidden">Latest audit entries</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Entity</th>
                </tr>
              </thead>
              <tbody>
                {(audit ?? []).slice(0, 10).map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.created_at)}</td>
                    <td>{entry.actor_role ?? '—'}</td>
                    <td>{entry.action.replace('_', ' ')}</td>
                    <td className="mono">{entry.entity_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No audit entry yet" />
        )}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <Button variant="ghost" onClick={() => undefined}>
            Export CSV
          </Button>
        </div>
      </section>
    </>
  );
}
