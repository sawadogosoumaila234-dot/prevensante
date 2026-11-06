import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { SeverityBadge, StatusBadge } from '../../components/Badges';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { getCorrectiveAction, listProfiles } from '../../lib/api';
import { reopenAction, verifyAndCloseAction, rejectClosureProof } from '../../lib/mutations';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n/en';

/**
 * Verification et cloture d'une action corrective (route
 * `/hse/actions/:id/verify`).
 *
 * Le verificateur ne peut pas etre l'actionnaire ; le rejet de la preuve
 * renvoie l'action en `in_progress` et incremente `reopen_count` (CR04).
 */
export default function ActionVerify() {
  const { id } = useParams();
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: action, isLoading } = useQuery({
    queryKey: ['action', id],
    queryFn: () => getCorrectiveAction(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['action', id] });
    void queryClient.invalidateQueries({ queryKey: ['actions'] });
  };

  const verifyMutation = useMutation({
    mutationFn: () => verifyAndCloseAction(id ?? '', user?.id ?? ''),
    onSuccess: () => {
      setMessage('The action has been verified and closed.');
      setError('');
      invalidate();
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : t('error.selfVerification'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => rejectClosureProof(id ?? '', reason, user?.id ?? ''),
    onSuccess: () => {
      setRejectOpen(false);
      setMessage('The closure proof has been rejected. The action is back in progress.');
      invalidate();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : 'The proof could not be rejected.'),
  });

  const reopenMutation = useMutation({
    mutationFn: (reason: string) => reopenAction(id ?? '', reason, user?.id ?? ''),
    onSuccess: () => {
      setReopenOpen(false);
      setMessage('The action has been reopened.');
      invalidate();
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
  const isSelfVerification = action.owner_id === user?.id;
  const eligible = action.status === 'to_verify' && !isSelfVerification;

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

      {!eligible ? (
        <Alert tone="warning" title="This action is not eligible for verification">
          {isSelfVerification
            ? t('error.selfVerification')
            : action.status !== 'to_verify'
              ? `The action is in the status « ${action.status.replace('_', ' ')} ». Only an action submitted for verification can be verified.`
              : 'The action cannot be verified.'}
        </Alert>
      ) : null}

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Verification</h2>
        <dl className="dl-grid">
          <dt>Owner</dt>
          <dd>{owner?.full_name ?? 'Unassigned'}</dd>
          <dt>Due date</dt>
          <dd>{formatDate(action.due_at)}</dd>
          <dt>Closure proof</dt>
          <dd>{action.closure_evidence_path ?? 'Not attached'}</dd>
          <dt>Closure note</dt>
          <dd>{action.closure_note ?? '—'}</dd>
          <dt>Submitted for verification</dt>
          <dd>{action.submitted_for_verification_at ? formatDate(action.submitted_for_verification_at) : '—'}</dd>
          <dt>Reopen count</dt>
          <dd>{action.reopen_count}</dd>
          <dt>Verified by</dt>
          <dd>{action.verified_by ? (profiles?.find((p) => p.id === action.verified_by)?.full_name ?? action.verified_by) : '—'}</dd>
        </dl>

        <div className="btn-row" style={{ marginTop: 20 }}>
          <Button disabled={!eligible} loading={verifyMutation.isPending} onClick={() => verifyMutation.mutate()}>
            {t('action.verifyClose')}
          </Button>
          <Button variant="danger" disabled={action.status !== 'to_verify'} onClick={() => setRejectOpen(true)}>
            {t('action.rejectProof')}
          </Button>
          {action.status === 'closed' ? (
            <Button variant="ghost" onClick={() => setReopenOpen(true)}>
              {t('action.reopenAction')}
            </Button>
          ) : null}
        </div>
      </section>

      <ConfirmDialog
        open={rejectOpen}
        title="Reject the closure proof"
        confirmLabel={t('action.rejectProof')}
        reasonRequired
        reasonLabel="Reason for the rejection"
        description="The action goes back to « In progress » and the reopen count is incremented."
        onCancel={() => setRejectOpen(false)}
        onConfirm={(reason) => rejectMutation.mutate(reason)}
      />

      <ConfirmDialog
        open={reopenOpen}
        title="Reopen the action"
        confirmLabel={t('action.reopenAction')}
        reasonRequired
        reasonLabel="Reason for reopening"
        onCancel={() => setReopenOpen(false)}
        onConfirm={(reason) => reopenMutation.mutate(reason)}
      />
    </>
  );
}
