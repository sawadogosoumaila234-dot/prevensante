import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { FormField } from '../../components/FormField';
import { SeverityBadge, StatusBadge } from '../../components/Badges';
import { getCorrectiveAction, getSafetyEvent, listProfiles } from '../../lib/api';
import { startAction, submitActionForVerification } from '../../lib/mutations';
import { formatDate, isOverdue, overdueDays } from '../../lib/format';
import { t } from '../../lib/i18n/en';

/**
 * Traitement d'une action corrective (route `/hse/actions/:id`).
 *
 * « Submit for verification » est bloque tant qu'aucune preuve de cloture
 * n'est jointe (CR04).
 */
export default function ActionDetail() {
  const { id } = useParams();
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [evidence, setEvidence] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: action, isLoading } = useQuery({
    queryKey: ['action', id],
    queryFn: () => getCorrectiveAction(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });

  const { data: event } = useQuery({
    queryKey: ['event', action?.event_id],
    queryFn: () => getSafetyEvent(action?.event_id ?? ''),
    enabled: Boolean(action?.event_id),
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['action', id] });
    void queryClient.invalidateQueries({ queryKey: ['actions'] });
  };

  const startMutation = useMutation({
    mutationFn: () => startAction(id ?? ''),
    onSuccess: () => {
      setMessage('The action is now in progress.');
      invalidate();
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => submitActionForVerification(id ?? '', evidence, note),
    onSuccess: () => {
      setMessage('The action has been submitted for verification.');
      setError('');
      invalidate();
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : t('error.proofRequired'));
    },
  });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (!action) {
    return (
      <EmptyState
        title="Corrective action not found"
        action={
          <Link className="btn primary" to="/hse/actions">
            Back to the action list
          </Link>
        }
      />
    );
  }

  const owner = profiles?.find((p) => p.id === action.owner_id);
  const late = isOverdue(action.due_at) && !['closed', 'cancelled'].includes(action.status);
  const isOwner = user?.id === action.owner_id;

  return (
    <>
      <div className="page-head row">
        <div>
          <h1 className="mono" style={{ fontSize: 'var(--fs-22)' }}>
            {action.reference}
          </h1>
          <p className="sub">{action.title}</p>
        </div>
        <div className="head-actions">
          <StatusBadge status={action.status} />
          <SeverityBadge level={action.severity} />
        </div>
      </div>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      {late ? (
        <Alert tone="danger" title="Late action">
          The due date was passed {overdueDays(action.due_at)} day(s) ago.
        </Alert>
      ) : null}

      <section className="panel">
        <dl className="dl-grid">
          <dt>Description</dt>
          <dd>{action.description}</dd>
          <dt>Owner</dt>
          <dd>{owner?.full_name ?? 'Unassigned'}</dd>
          <dt>Due date</dt>
          <dd>{formatDate(action.due_at)}</dd>
          <dt>Started</dt>
          <dd>{action.started_at ? formatDate(action.started_at) : 'Not started'}</dd>
          <dt>Parent event</dt>
          <dd>
            {event ? (
              <Link to={`/hse/events/${event.id}`} className="mono">
                {event.reference}
              </Link>
            ) : (
              '—'
            )}
          </dd>
          <dt>Closure proof</dt>
          <dd>{action.closure_evidence_path ? 'Attached' : 'Not attached'}</dd>
          <dt>Reopen count</dt>
          <dd>{action.reopen_count}</dd>
          {action.closure_note ? (
            <>
              <dt>Closure note</dt>
              <dd>{action.closure_note}</dd>
            </>
          ) : null}
          {action.verified_by ? (
            <>
              <dt>Verified by</dt>
              <dd>{profiles?.find((p) => p.id === action.verified_by)?.full_name ?? action.verified_by}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {!['closed', 'cancelled'].includes(action.status) ? (
        <section className="panel">
          <h2 style={{ fontSize: 'var(--fs-18)' }}>Treatment</h2>
          <div className="btn-row" style={{ marginBottom: 16 }}>
            {action.status === 'to_do' ? (
              <Button loading={startMutation.isPending} onClick={() => startMutation.mutate()}>
                {t('action.startWork')}
              </Button>
            ) : null}
          </div>

          <FormField
            id="closure-proof"
            label={t('action.attachProof')}
            required
            helper="A photo or a document reference. The proof is mandatory before submission."
            error={evidence.length === 0 && error ? t('error.proofRequired') : undefined}
          >
            <input
              id="closure-proof"
              className="input"
              type="text"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="events/evt-1/proof-guard.webp"
            />
          </FormField>

          <FormField id="closure-note-field" label="Comment">
            <textarea id="closure-note-field" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>

          <Button
            loading={submitMutation.isPending}
            disabled={evidence.trim().length === 0}
            onClick={() => submitMutation.mutate()}
          >
            {t('action.submitForVerification')}
          </Button>
          {!isOwner ? (
            <p className="small muted" style={{ marginTop: 8 }}>
              You are not the owner of this action: only the owner can submit it for verification.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
