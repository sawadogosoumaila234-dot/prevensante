import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { listMedicalRecords, listProfiles, listSafetyEvents } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { kindLabel } from '../../lib/i18n/labels';

/**
 * Dossiers de sante lies aux evenements (route `/medical`).
 *
 * Acces restreint (CR03) : un profil non habilite medical ne voit que la liste
 * vide et un message d'explication. Les donnees medicales ne sont jamais
 * exposees dans l'espace HSE non habilite.
 */
export default function MedicalPage() {
  const { user } = useSession();
  const authorized = Boolean(user?.is_medical_authorized || user?.role === 'occupational_physician');

  const { data: records, isLoading } = useQuery({
    queryKey: ['medical-records'],
    queryFn: () => listMedicalRecords(),
    enabled: authorized,
    staleTime: 60_000,
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    staleTime: 60_000,
  });

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => listSafetyEvents({}, null, 200),
    enabled: authorized,
    staleTime: 60_000,
  });

  if (!authorized) {
    return (
      <>
        <div className="page-head">
          <h1>Medical records</h1>
        </div>
        <Alert tone="warning" title="Medical confidentiality" role="alert">
          Medical data is restricted to profiles authorised for occupational health.
        </Alert>
        <EmptyState
          title="No medical data is available on this account"
          message="Medical records are restricted to authorised profiles."
        />
      </>
    );
  }

  const eventLabel = (eventId: string) => {
    const event = events?.items.find((e) => e.id === eventId);
    return event ? `${event.reference} — ${kindLabel(event.kind)}` : eventId;
  };

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Medical records</h1>
          <p className="sub">Restricted area: access is logged and limited to authorised profiles.</p>
        </div>
        <div className="head-actions">
          <Button variant="secondary">New medical record</Button>
        </div>
      </div>

      <Alert tone="info">
        Medical data must never be displayed in the HSE space for an unauthorised profile.
      </Alert>

      <section className="panel">
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : (records ?? []).length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <caption className="visually-hidden">Medical records linked to safety events</caption>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Injury type</th>
                  <th scope="col">Body part</th>
                  <th scope="col">Recorded</th>
                  <th scope="col">Visibility</th>
                </tr>
              </thead>
              <tbody>
                {(records ?? []).map((record) => (
                  <tr key={record.id}>
                    <td>
                      <Link to={`/medical/${record.event_id}`}>{eventLabel(record.event_id)}</Link>
                    </td>
                    <td>
                      {record.subject_id
                        ? (profiles?.find((p) => p.id === record.subject_id)?.full_name ?? record.subject_id)
                        : '—'}
                    </td>
                    <td>{record.injury_type ?? '—'}</td>
                    <td>{record.body_part ?? '—'}</td>
                    <td>{formatDateTime(record.recorded_at)}</td>
                    <td>{record.visibility.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No medical record for this scope" />
        )}
      </section>

      <p className="small muted">
        <Link to="/hse">Back to the HSE dashboard</Link>
      </p>
    </>
  );
}
