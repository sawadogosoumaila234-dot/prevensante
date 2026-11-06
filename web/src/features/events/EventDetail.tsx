import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { SeverityBadge, StatusBadge } from '../../components/Badges';
import { Timeline, type TimelineEntry } from '../../components/Timeline';
import { ActionCard } from '../../components/ActionCard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  getSafetyEvent,
  listCorrectiveActions,
  listEventLogs,
  listEscalations,
  listProfiles,
  listSites,
  listZones,
} from '../../lib/api';
import {
  addEventComment,
  changeEventSeverity,
  closeSafetyEvent,
  escalateSafetyEvent,
} from '../../lib/mutations';
import { formatDateTime, hoursSince } from '../../lib/format';
import { kindLabel } from '../../lib/i18n/labels';
import { t } from '../../lib/i18n/en';

const TABS = ['Overview', 'Timeline', 'Corrective actions', 'Escalations', 'Photos', 'Comments'] as const;
type Tab = (typeof TABS)[number];

/**
 * Detail d'un evenement (route `/hse/events/:id`), organise en onglets.
 */
export default function EventDetail() {
  const { id } = useParams();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('Overview');
  const [comment, setComment] = useState('');
  const [severityDialog, setSeverityDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [escalateDialog, setEscalateDialog] = useState(false);
  const [closureNote, setClosureNote] = useState('');
  const [verifierName, setVerifierName] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [severityChoice, setSeverityChoice] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [message, setMessage] = useState('');

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getSafetyEvent(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: logs } = useQuery({
    queryKey: ['event-logs', id],
    queryFn: () => listEventLogs(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const { data: actions } = useQuery({
    queryKey: ['event-actions', id],
    queryFn: () => listCorrectiveActions({ event_id: id }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const { data: escalations } = useQuery({
    queryKey: ['escalations'],
    queryFn: () => listEscalations(),
    staleTime: 60_000,
  });

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const { data: zones } = useQuery({
    queryKey: ['zones', event?.site_id],
    queryFn: () => listZones(event?.site_id),
    enabled: Boolean(event?.site_id),
    staleTime: 60_000,
  });
  const { data: profiles } = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, staleTime: 60_000 });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['event', id] });
    void queryClient.invalidateQueries({ queryKey: ['event-logs', id] });
    void queryClient.invalidateQueries({ queryKey: ['event-actions', id] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const severityMutation = useMutation({
    mutationFn: () => changeEventSeverity(id ?? '', severityChoice, user?.id ?? '', 'Severity changed from the event detail screen.'),
    onSuccess: () => {
      setSeverityDialog(false);
      setMessage('The severity has been updated.');
      invalidate();
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => closeSafetyEvent(id ?? '', closureNote, verifierName, user?.id ?? ''),
    onSuccess: () => {
      setCloseDialog(false);
      setClosureNote('');
      setVerifierName('');
      setMessage('The event has been closed.');
      invalidate();
    },
  });

  const escalateMutation = useMutation({
    mutationFn: () =>
      escalateSafetyEvent(
        id ?? '',
        'site_director',
        escalationReason,
        user?.id ?? '',
        profiles?.find((p) => p.role === 'site_director')?.id ?? null,
        'site_director',
      ),
    onSuccess: () => {
      setEscalateDialog(false);
      setEscalationReason('');
      setMessage('The event has been escalated to the site director.');
      invalidate();
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => addEventComment(id ?? '', user?.id ?? '', user?.role ?? 'worker', comment),
    onSuccess: () => {
      setComment('');
      setMessage('The comment has been added to the timeline.');
      void queryClient.invalidateQueries({ queryKey: ['event-logs', id] });
    },
  });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (!event) {
    return (
      <EmptyState
        title="Event not found"
        message="This event does not exist or is outside your scope."
        action={
          <Link className="btn primary" to="/hse/events">
            Back to the event list
          </Link>
        }
      />
    );
  }

  const isHse = user?.role === 'hse_officer';
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'site_director';
  const site = sites?.find((s) => s.id === event.site_id);
  const zone = zones?.find((z) => z.id === event.zone_id);
  const reporter = profiles?.find((p) => p.id === event.reporter_id);

  const entries: TimelineEntry[] = (logs ?? []).map((log) => ({
    id: log.id,
    title: log.note || log.action.replace('_', ' '),
    detail:
      log.field_name && log.old_value && log.new_value
        ? `${log.field_name}: ${log.old_value} → ${log.new_value}`
        : log.action.replace('_', ' '),
    at: log.created_at,
    icon: '•',
  }));

  const eventEscalations = (escalations ?? []).filter((e) => e.event_id === event.id);

  return (
    <>
      <div className="page-head row">
        <div>
          <h1 className="mono" style={{ fontSize: 'var(--fs-22)' }}>
            {event.reference}
          </h1>
          <p className="sub">
            {kindLabel(event.kind)} — {site?.name ?? event.site_id}
            {zone ? ` / ${zone.name}` : ''} — {hoursSince(event.reported_at).toFixed(0)} h since the
            report
          </p>
        </div>
        <div className="head-actions">
          <StatusBadge status={event.status} />
          <SeverityBadge level={event.severity} />
        </div>
      </div>

      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="tabs" role="tablist" aria-label="Event sections">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'Overview' ? (
        <section className="panel">
          <dl className="dl-grid">
            <dt>Type</dt>
            <dd>{kindLabel(event.kind)}</dd>
            <dt>Status</dt>
            <dd>{event.status.replace('_', ' ')}</dd>
            <dt>Severity</dt>
            <dd>{event.severity}</dd>
            <dt>Site</dt>
            <dd>{site?.name ?? event.site_id}</dd>
            <dt>Zone</dt>
            <dd>{zone?.name ?? 'Not specified'}</dd>
            <dt>Equipment</dt>
            <dd>{event.equipment_id ?? 'Not specified'}</dd>
            <dt>Reporter</dt>
            <dd>{event.is_anonymous ? 'Anonymous reporter' : (reporter?.full_name ?? 'Unknown')}</dd>
            <dt>Occurred at</dt>
            <dd>{formatDateTime(event.occurred_at)}</dd>
            <dt>Reported at</dt>
            <dd>{formatDateTime(event.reported_at)}</dd>
            <dt>Activity</dt>
            <dd>{event.activity}</dd>
            <dt>Description</dt>
            <dd>{event.description}</dd>
            <dt>Immediate measures</dt>
            <dd>{event.immediate_measures}</dd>
            <dt>Reported consequences</dt>
            <dd>{event.reported_consequences}</dd>
            <dt>Work stopped</dt>
            <dd>{event.work_stoppage ? 'Yes' : 'No'}</dd>
            <dt>Injury reported</dt>
            <dd>{event.injury_reported ? 'Yes' : 'No'}</dd>
          </dl>
        </section>
      ) : null}

      {tab === 'Timeline' ? (
        <section className="panel">
          <Timeline entries={entries} />
        </section>
      ) : null}

      {tab === 'Corrective actions' ? (
        <section className="panel">
          {actions && actions.items.length > 0 ? (
            actions.items.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                ownerName={profiles?.find((p) => p.id === action.owner_id)?.full_name}
              />
            ))
          ) : (
            <EmptyState title="No corrective action attached to this event yet" />
          )}
          {isHse ? (
            <div className="btn-row" style={{ marginTop: 16 }}>
              <Link className="btn primary" to={`/hse/events/${event.id}/actions`}>
                {t('action.assignAction')}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'Escalations' ? (
        <section className="panel">
          {eventEscalations.length > 0 ? (
            eventEscalations.map((esc) => (
              <div className="card" key={esc.id}>
                <div className="row-between">
                  <strong>{esc.level.replace('_', ' ')}</strong>
                  <span className="small muted">{formatDateTime(esc.created_at)}</span>
                </div>
                <p>{esc.reason}</p>
                <p className="small muted">
                  {esc.acknowledged_at
                    ? `Acknowledged on ${formatDateTime(esc.acknowledged_at)}`
                    : 'Not acknowledged yet'}
                </p>
              </div>
            ))
          ) : (
            <EmptyState title="No escalation for this event" />
          )}
        </section>
      ) : null}

      {tab === 'Photos' ? (
        <section className="panel">
          {event.photo_paths.length > 0 ? (
            <div className="photo-grid">
              {event.photo_paths.map((path) => (
                <img
                  key={path}
                  className="thumb"
                  src={path}
                  alt="Photo attached to the report"
                  loading="lazy"
                  decoding="async"
                  width={72}
                  height={72}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No photo attached to this report" />
          )}
        </section>
      ) : null}

      {tab === 'Comments' ? (
        <section className="panel">
          <div className="field">
            <label htmlFor="event-comment">Add a comment</label>
            <textarea
              id="event-comment"
              className="textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <Button loading={commentMutation.isPending} disabled={comment.trim().length === 0} onClick={() => commentMutation.mutate()}>
            Add comment
          </Button>
          <hr className="divider" />
          <Timeline entries={entries.filter((e) => e.detail === 'commented')} />
        </section>
      ) : null}

      {(isHse || isSupervisor) && event.status !== 'closed' ? (
        <section className="panel">
          <h2 style={{ fontSize: 'var(--fs-18)' }}>Actions</h2>
          <div className="btn-row">
            {isHse ? (
              <>
                <Link className="btn primary" to={`/hse/events/${event.id}/triage`}>
                  {t('action.triage')}
                </Link>
                <Button variant="secondary" onClick={() => setSeverityDialog(true)}>
                  Change severity
                </Button>
                <Button variant="secondary" onClick={() => setEscalateDialog(true)}>
                  Escalate
                </Button>
              </>
            ) : null}
            <Button variant="danger" onClick={() => setCloseDialog(true)}>
              Close event
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={severityDialog}
        title="Change the severity"
        confirmLabel="Change severity"
        danger={false}
        reasonRequired={false}
        description="The new severity replaces the previous one. The change is traced in the timeline."
        onCancel={() => setSeverityDialog(false)}
        onConfirm={() => severityMutation.mutate()}
      >
        <div className="field">
          <label htmlFor="severity-choice">New severity</label>
          <select
            id="severity-choice"
            className="select"
            value={severityChoice}
            onChange={(e) => setSeverityChoice(e.target.value as typeof severityChoice)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={closeDialog}
        title="Close the event"
        confirmLabel="Close event"
        description="Closing requires a reason and the name of the verifier."
        onCancel={() => setCloseDialog(false)}
        onConfirm={() => closeMutation.mutate()}
      >
        <div className="field">
          <label htmlFor="closure-note">Closure reason</label>
          <textarea
            id="closure-note"
            className="textarea"
            value={closureNote}
            onChange={(e) => setClosureNote(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="verifier-name">Verified by</label>
          <input
            id="verifier-name"
            className="input"
            type="text"
            value={verifierName}
            onChange={(e) => setVerifierName(e.target.value)}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={escalateDialog}
        title="Escalate the event"
        confirmLabel="Escalate"
        description="The event is escalated to the site director and notified."
        reasonRequired
        reasonLabel="Escalation reason"
        onCancel={() => setEscalateDialog(false)}
        onConfirm={(reason) => {
          setEscalationReason(reason);
          escalateMutation.mutate();
        }}
      />
    </>
  );
}
