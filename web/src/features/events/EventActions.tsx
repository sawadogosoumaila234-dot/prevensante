import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { FormField } from '../../components/FormField';
import { ActionCard } from '../../components/ActionCard';
import { getSafetyEvent, listCorrectiveActions, listProfiles } from '../../lib/api';
import { createCorrectiveAction } from '../../lib/mutations';
import { t } from '../../lib/i18n/en';

/**
 * Actions correctives rattachees a un evenement (route
 * `/hse/events/:id/actions`) : creation et suivi.
 */
export default function EventActions() {
  const { id } = useParams();
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [dueAt, setDueAt] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getSafetyEvent(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const { data: actions } = useQuery({
    queryKey: ['event-actions', id],
    queryFn: () => listCorrectiveActions({ event_id: id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });

  const mutation = useMutation({
    mutationFn: () => {
      const owner = profiles?.find((p) => p.id === ownerId);
      return createCorrectiveAction({
        event_id: id ?? '',
        title,
        description,
        owner_id: ownerId,
        owner_role: owner?.role ?? 'action_owner',
        severity,
        due_at: dueAt ? new Date(dueAt).toISOString() : new Date().toISOString(),
        created_by: user?.id ?? '',
      });
    },
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setOwnerId('');
      setDueAt('');
      setMessage('The corrective action has been created.');
      setError('');
      void queryClient.invalidateQueries({ queryKey: ['event-actions', id] });
      void queryClient.invalidateQueries({ queryKey: ['actions'] });
    },
    onError: () => setError('The corrective action could not be created.'),
  });

  if (!event) {
    return (
      <EmptyState
        title="Event not found"
        action={
          <Link className="btn primary" to="/hse/events">
            Back to the event list
          </Link>
        }
      />
    );
  }

  const owners = (profiles ?? []).filter((p) =>
    ['action_owner', 'maintenance_lead', 'supervisor', 'hse_officer'].includes(p.role),
  );

  return (
    <>
      <div className="page-head">
        <h1>{t('action.assignAction')}</h1>
        <p className="sub">
          <span className="mono">{event.reference}</span> — {event.description.slice(0, 90)}
        </p>
      </div>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>New corrective action</h2>
        <FormField id="action-title" label="Title" required>
          <input id="action-title" className="input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField id="action-description" label="Description" required>
          <textarea id="action-description" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <div className="form-grid">
          <FormField id="action-owner" label="Owner" required>
            <select id="action-owner" className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Select an owner</option>
              {owners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {p.job_title ?? p.role}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="action-severity" label="Severity" required>
            <select
              id="action-severity"
              className="select"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </FormField>
        </div>
        <FormField id="action-due" label="Due date" required>
          <input id="action-due" className="input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </FormField>
        <Button
          loading={mutation.isPending}
          disabled={title.trim().length < 3 || description.trim().length < 3 || !ownerId || !dueAt}
          onClick={() => mutation.mutate()}
        >
          {t('action.assignAction')}
        </Button>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Actions already attached</h2>
        {actions && actions.items.length > 0 ? (
          actions.items.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              ownerName={profiles?.find((p) => p.id === action.owner_id)?.full_name}
              to={`/hse/actions/${action.id}`}
            />
          ))
        ) : (
          <EmptyState title={t('empty.actions')} />
        )}
      </section>
    </>
  );
}
