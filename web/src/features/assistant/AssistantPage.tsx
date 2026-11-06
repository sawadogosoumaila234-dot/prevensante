import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { AiProposalCard } from '../../components/AiProposalCard';
import { listAiProposals, listSafetyDocuments } from '../../lib/api';
import { requestAssistantProposal, reviewAiProposal } from '../../lib/mutations';
import { t } from '../../lib/i18n/en';

const LIMITATION =
  'This answer does not replace work permits, lockout procedures or the decisions of competent persons.';

/**
 * Assistant IA (route `/hse/assistant`).
 *
 * L'assistant ne modifie jamais un evenement de lui-meme ; les references citees
 * pointent vers des documents valides uniquement. Ce module est charge
 * dynamiquement (section 11.5).
 */
export default function AssistantPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState('');
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<{ body: string; refs: string[] } | null>(null);

  const { data: proposals, isLoading } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => listAiProposals(),
    staleTime: 60_000,
  });

  const { data: documents } = useQuery({
    queryKey: ['documents-validated'],
    queryFn: () => listSafetyDocuments('validated'),
    staleTime: 60_000,
  });

  const pending = (proposals ?? []).filter((p) => p.status === 'pending_review');
  const reviewed = (proposals ?? []).filter((p) => p.status !== 'pending_review');

  const askMutation = useMutation({
    mutationFn: async () => {
      const proposal = await requestAssistantProposal({
        event_id: null,
        proposal_type: 'instruction_lookup',
        asked_by: user?.id ?? '',
      });
      return proposal;
    },
    onSuccess: (proposal) => {
      setMessage('The assistant has answered from the validated corpus.');
      setAnswer({
        body:
          'The validated instruction that matches your question is shown below. It must be applied by a competent person on site.',
        refs: proposal.references,
      });
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: () => setMessage(t('error.assistantUnavailable')),
  });

  const reviewMutation = useMutation({
    mutationFn: (args: { id: string; decision: 'accepted' | 'rejected' }) =>
      reviewAiProposal({
        proposal_id: args.id,
        decision: args.decision,
        reviewed_by: user?.id ?? '',
        review_note:
          args.decision === 'accepted'
            ? 'Proposal accepted after reading the validated instruction.'
            : 'Proposal rejected: it does not match the site situation.',
      }),
    onSuccess: () => {
      setMessage('The decision has been recorded.');
      void queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });

  return (
    <>
      <div className="page-head">
        <h1>{t('nav.assistant')}</h1>
        <p className="sub">
          Suggestions based on the validated instruction corpus. The assistant never modifies an
          event by itself.
        </p>
      </div>

      <Alert tone="warning" title="Limits of the assistant">
        {LIMITATION}
      </Alert>

      {message ? <Alert tone="info">{message}</Alert> : null}

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Ask for a validated instruction</h2>
        <div className="field">
          <label htmlFor="assistant-question">Your question</label>
          <textarea
            id="assistant-question"
            className="textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What must be done before removing a crusher guard?"
          />
        </div>
        <Button
          loading={askMutation.isPending}
          disabled={question.trim().length < 5}
          onClick={() => askMutation.mutate()}
        >
          {t('action.askAssistant')}
        </Button>

        {answer ? (
          <div className="chat" style={{ marginTop: 16 }}>
            <div className="msg ai">
              <p className="msg-role">Assistant</p>
              <p>{answer.body}</p>
              <div className="msg-refs">
                {answer.refs.map((ref) => (
                  <span key={ref} className="mono">
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Proposals to review</h2>
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : pending.length > 0 ? (
          pending.map((proposal) => (
            <AiProposalCard
              key={proposal.id}
              proposal={proposal}
              categoryLabel={
                proposal.suggested_category_id
                  ? `Category ${proposal.suggested_category_id}`
                  : undefined
              }
              documentTitle={
                documents?.find((d) => d.id === proposal.suggested_document_id)?.title
              }
              busy={reviewMutation.isPending}
              onAccept={() => reviewMutation.mutate({ id: proposal.id, decision: 'accepted' })}
              onReject={() => reviewMutation.mutate({ id: proposal.id, decision: 'rejected' })}
            />
          ))
        ) : (
          <EmptyState title="No proposal is waiting for a decision" />
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Reviewed proposals</h2>
        {reviewed.length > 0 ? (
          reviewed.map((proposal) => (
            <AiProposalCard
              key={proposal.id}
              proposal={proposal}
              documentTitle={documents?.find((d) => d.id === proposal.suggested_document_id)?.title}
            />
          ))
        ) : (
          <EmptyState title="No proposal has been reviewed yet" />
        )}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 'var(--fs-18)' }}>Validated corpus</h2>
        <p className="small muted">
          Only validated documents can be cited. The full corpus is available on the instructions
          screen.
        </p>
        <div className="btn-row">
          <Link className="btn secondary" to="/instructions">
            Open the instruction corpus
          </Link>
        </div>
      </section>
    </>
  );
}
