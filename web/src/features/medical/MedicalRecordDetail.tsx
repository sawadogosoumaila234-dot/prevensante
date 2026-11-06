import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { getMedicalRecordForEvent, getSafetyEvent, listProfiles } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { kindLabel } from '../../lib/i18n/labels';

/**
 * Dossier medical d'un evenement (route `/medical/:eventId`).
 *
 * L'acces est filtre par habilitation medicale (CR03) : un profil non
 * habilite ne recupere aucune donnee de sante.
 */
export default function MedicalRecordDetail() {
  const { eventId } = useParams();
  const { user } = useSession();
  const authorized = Boolean(user?.is_medical_authorized || user?.role === 'occupational_physician');

  const { data: record, isLoading } = useQuery({
    queryKey: ['medical-record-for-event', eventId],
    queryFn: () => getMedicalRecordForEvent(eventId ?? ''),
    enabled: authorized && Boolean(eventId),
    staleTime: 60_000,
  });

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => getSafetyEvent(eventId ?? ''),
    enabled: authorized && Boolean(eventId),
    staleTime: 60_000,
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    staleTime: 60_000,
  });

  if (!authorized) {
    return (
      <>
        <Alert tone="warning" title="Medical confidentiality" role="alert">
          Medical data is restricted to profiles authorised for occupational health.
        </Alert>
        <EmptyState title="No medical data is available on this account" />
      </>
    );
  }

  if (isLoading) return <p className="muted">Loading…</p>;
  if (!record) {
    return (
      <EmptyState
        title="Medical record not found"
        message="No medical record is attached to this event, or it is not accessible to you."
        action={
          <Link className="btn primary" to="/medical">
            Back to the medical records
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Medical record</h1>
        <p className="sub">
          {event ? `${event.reference} — ${kindLabel(event.kind)}` : (eventId ?? '')}
        </p>
      </div>

      <section className="panel">
        <dl className="dl-grid">
          <dt>Subject</dt>
          <dd>
            {record.subject_id
              ? (profiles?.find((p) => p.id === record.subject_id)?.full_name ?? record.subject_id)
              : 'Not identified'}
          </dd>
          <dt>Injury type</dt>
          <dd>{record.injury_type ?? '—'}</dd>
          <dt>Body part</dt>
          <dd>{record.body_part ?? '—'}</dd>
          <dt>Care given</dt>
          <dd>{record.care_given ?? '—'}</dd>
          <dt>Fitness return</dt>
          <dd>{record.fitness_return ?? '—'}</dd>
          <dt>Visibility</dt>
          <dd>{record.visibility.replace('_', ' ')}</dd>
          <dt>Recorded by</dt>
          <dd>
            {record.recorded_by
              ? (profiles?.find((p) => p.id === record.recorded_by)?.full_name ?? record.recorded_by)
              : '—'}
          </dd>
          <dt>Recorded at</dt>
          <dd>{formatDateTime(record.recorded_at)}</dd>
        </dl>
      </section>

      <p className="small muted">
        <Link to="/medical">Back to the medical records</Link>
      </p>
    </>
  );
}
