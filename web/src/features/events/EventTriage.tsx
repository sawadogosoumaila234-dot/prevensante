import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { FormField } from '../../components/FormField';
import { AiProposalCard } from '../../components/AiProposalCard';
import { getSafetyEvent, listAiProposals, listEquipments, listRiskCategories, listZones } from '../../lib/api';
import { requestAssistantProposal, reviewAiProposal, triageSafetyEvent } from '../../lib/mutations';
import { kindLabel } from '../../lib/i18n/labels';
import { t } from '../../lib/i18n/en';

type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Triage d'un evenement (route `/hse/events/:id/triage`).
 *
 * Une proposition IA n'est jamais enregistree automatiquement : elle doit etre
 * explicitement acceptee ou rejetee par un humain (CR06).
 */
export default function EventTriage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const queryClient = useQueryClient();

  const [categoryId, setCategoryId] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [zoneId, setZoneId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [proposalHandled, setProposalHandled] = useState(false);

  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getSafetyEvent(id ?? ''),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const { data: zones } = useQuery({
    queryKey: ['zones', event?.site_id],
    queryFn: () => listZones(event?.site_id),
    enabled: Boolean(event?.site_id),
    staleTime: 60_000,
  });

  const { data: equipments } = useQuery({
    queryKey: ['equipments', event?.site_id, zoneId],
    queryFn: () => listEquipments(event?.site_id, zoneId || undefined),
    enabled: Boolean(event?.site_id),
    staleTime: 60_000,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listRiskCategories(),
    staleTime: 60_000,
  });

  const { data: proposals } = useQuery({
    queryKey: ['proposals', id],
    queryFn: () => listAiProposals(),
    staleTime: 60_000,
  });

  const pendingProposal = (proposals ?? []).find(
    (p) => p.event_id === id && p.status === 'pending_review',
  );

  useEffect(() => {
    if (!event) return;
    setSeverity(event.severity);
    setZoneId(event.zone_id ?? '');
    setEquipmentId(event.equipment_id ?? '');
  }, [event]);

  const saveMutation = useMutation({
    mutationFn: () =>
      triageSafetyEvent({
        event_id: id ?? '',
        risk_category_id: categoryId || null,
        severity,
        zone_id: zoneId || null,
        equipment_id: equipmentId || null,
        triaged_by: user?.id ?? '',
        note: note || 'Triage completed.',
      }),
    onSuccess: () => {
      setMessage('The triage has been saved.');
      void queryClient.invalidateQueries({ queryKey: ['event', id] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      requestAssistantProposal({
        event_id: id ?? null,
        proposal_type: 'classification',
        asked_by: user?.id ?? '',
      }),
    onSuccess: () => {
      setMessage('The assistant has been asked for a classification.');
      void queryClient.invalidateQueries({ queryKey: ['proposals', id] });
    },
    onError: () => setMessage(t('error.assistantUnavailable')),
  });

  const reviewMutation = useMutation({
    mutationFn: async (decision: 'accepted' | 'rejected') => {
      if (!pendingProposal) return;
      await reviewAiProposal({
        proposal_id: pendingProposal.id,
        decision,
        reviewed_by: user?.id ?? '',
        review_note:
          decision === 'accepted'
            ? 'Category confirmed by the HSE officer after reading the validated instructions.'
            : 'Proposal rejected: the classification does not match the site situation.',
      });
      if (decision === 'accepted') {
        setCategoryId(pendingProposal.suggested_category_id ?? '');
        if (pendingProposal.suggested_severity) setSeverity(pendingProposal.suggested_severity);
        setProposalHandled(true);
      }
    },
    onSuccess: () => {
      setMessage('The decision has been recorded.');
      void queryClient.invalidateQueries({ queryKey: ['proposals', id] });
    },
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

  return (
    <>
      <div className="page-head">
        <h1>{t('action.triage')}</h1>
        <p className="sub">
          <span className="mono">{event.reference}</span> — {kindLabel(event.kind)}
        </p>
      </div>

      {message ? <Alert tone="success">{message}</Alert> : null}

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Assistant proposal</h2>
        {pendingProposal ? (
          <>
            <AiProposalCard
              proposal={pendingProposal}
              categoryLabel={
                categories?.find((c) => c.id === pendingProposal.suggested_category_id)?.label
              }
              busy={reviewMutation.isPending}
              onAccept={() => reviewMutation.mutate('accepted')}
              onReject={() => reviewMutation.mutate('rejected')}
            />
            <Alert tone="warning" title="Human confirmation required">
              The assistant can be wrong. A competent person must confirm this classification.
            </Alert>
            {proposalHandled ? (
              <p className="small muted">
                The proposal has been accepted and the fields below are pre-filled. The triage is
                only saved when you press « Save triage ».
              </p>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No assistant proposal for this event"
            message="You can ask the assistant for a classification suggestion."
            action={
              <Button variant="secondary" loading={requestMutation.isPending} onClick={() => requestMutation.mutate()}>
                {t('action.askAssistant')}
              </Button>
            }
          />
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Triage</h2>
        <div className="form-grid">
          <FormField id="triage-category" label="Risk category" required>
            <select
              id="triage-category"
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select a category</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.code})
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="triage-severity" label="Severity" required>
            <select
              id="triage-severity"
              className="select"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </FormField>

          <FormField id="triage-zone" label="Zone">
            <select
              id="triage-zone"
              className="select"
              value={zoneId}
              onChange={(e) => {
                setZoneId(e.target.value);
                setEquipmentId('');
              }}
            >
              <option value="">Select a zone</option>
              {(zones ?? []).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="triage-equipment" label="Equipment">
            <select
              id="triage-equipment"
              className="select"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
            >
              <option value="">No specific equipment</option>
              {(equipments ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.asset_code})
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField id="triage-note" label="Triage note" helper="Kept in the event timeline.">
          <textarea id="triage-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>

        <div className="btn-row">
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            Save triage
          </Button>
          <Button variant="ghost" onClick={() => navigate(`/hse/events/${id}`)}>
            Cancel
          </Button>
        </div>
      </section>
    </>
  );
}
