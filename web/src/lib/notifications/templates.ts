/**
 * Gabarits d'email et SMS (section 14 — chaines de notification).
 *
 * Les corps sont en anglais ; le contenu d'une consigne de securite n'est
 * jamais traduit, il est cite tel quel.
 */

export interface NotificationTemplate {
  key: string;
  channel: 'email' | 'sms';
  subject: string;
  body: (vars: Record<string, string>) => string;
}

export const TEMPLATES: NotificationTemplate[] = [
  {
    key: 'event_created',
    channel: 'email',
    subject: 'Your report {reference} has been recorded',
    body: (v) =>
      `Your report ${v.reference} has been recorded on ${v.site}. You can follow its progress from your reports list.`,
  },
  {
    key: 'critical_event_hse',
    channel: 'email',
    subject: 'Critical danger reported at {site}',
    body: (v) =>
      `A critical danger was reported at ${v.site}. Reference ${v.reference}. Immediate triage is required.`,
  },
  {
    key: 'critical_event_hse',
    channel: 'sms',
    subject: 'Critical danger reported at {site}',
    body: (v) => `Critical danger reported at ${v.site}. Reference ${v.reference}.`,
  },
  {
    key: 'event_rejected',
    channel: 'email',
    subject: 'Your report {reference} was closed without action',
    body: (v) => `Your report ${v.reference} was closed without action. Reason: ${v.reason}`,
  },
  {
    key: 'action_assigned',
    channel: 'email',
    subject: 'Corrective action {reference} assigned to you',
    body: (v) =>
      `Corrective action ${v.reference} has been assigned to you with a due date of ${v.due_at}. Attach a closure proof to submit it for verification.`,
  },
  {
    key: 'action_overdue',
    channel: 'sms',
    subject: 'Corrective action {reference} is late',
    body: (v) => `Corrective action ${v.reference} is late. It was due on ${v.due_at}.`,
  },
  {
    key: 'action_verified',
    channel: 'email',
    subject: 'Corrective action {reference} has been verified and closed',
    body: (v) => `Corrective action ${v.reference} has been verified and closed by a competent person.`,
  },
  {
    key: 'weekly_summary',
    channel: 'email',
    subject: 'Weekly safety summary — {site}',
    body: (v) =>
      `Weekly safety summary for ${v.site}: ${v.events} events recorded, ${v.overdue} corrective actions late.`,
  },
];

/** Rend un gabarit avec ses variables. */
export function renderTemplate(
  template: NotificationTemplate,
  vars: Record<string, string>,
): { subject: string; body: string } {
  const fill = (s: string) =>
    s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
  return { subject: fill(template.subject), body: fill(template.body(vars)) };
}
