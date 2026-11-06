/**
 * Libelles d'interface — une seule langue : l'anglais.
 *
 * Les cles de la table i18n (section 11.6 de la specification) sont reprise
 * telles quelles et typees, pour permettre l'ajout ulterieur d'une langue.
 * Les consignes de securite ne sont pas traduites : elles restent dans la
 * langue de leur document source.
 */
export const en = {
  'nav.report': 'Report a hazard',
  'nav.myReports': 'My reports',
  'nav.instructions': 'Safety instructions',
  'nav.dashboard': 'Safety dashboard',
  'nav.events': 'Safety events',
  'nav.actions': 'Corrective actions',
  'nav.escalations': 'Escalations',
  'nav.assistant': 'Prevention assistant',
  'nav.recurrences': 'Recurrent risks',
  'nav.reports': 'Reports',
  'nav.notifications': 'Notifications',
  'nav.settings': 'Settings',

  'kind.danger': 'Danger',
  'kind.incident': 'Incident',
  'kind.accident': 'Accident',

  'status.submitted': 'Submitted',
  'status.under_review': 'Under review',
  'status.triaged': 'Triaged',
  'status.in_progress': 'In progress',
  'status.awaiting_verification': 'Awaiting verification',
  'status.closed': 'Closed',
  'status.rejected': 'Rejected',
  'status.escalated': 'Escalated',

  'severity.low': 'Low',
  'severity.medium': 'Medium',
  'severity.high': 'High',
  'severity.critical': 'Critical',

  'actionStatus.to_do': 'To do',
  'actionStatus.in_progress': 'In progress',
  'actionStatus.to_verify': 'To verify',
  'actionStatus.closed': 'Closed',
  'actionStatus.cancelled': 'Cancelled',

  'action.submitReport': 'Submit report',
  'action.triage': 'Triage event',
  'action.assignAction': 'Assign corrective action',
  'action.startWork': 'Start work',
  'action.attachProof': 'Attach closure proof',
  'action.submitForVerification': 'Submit for verification',
  'action.verifyClose': 'Verify and close',
  'action.rejectProof': 'Reject closure proof',
  'action.reopenAction': 'Reopen action',
  'action.askAssistant': 'Ask the assistant',
  'action.acceptProposal': 'Accept the proposal',
  'action.rejectProposal': 'Reject the proposal',
  'action.export': 'Export report',

  'error.required': 'This field is required.',
  'error.descriptionRequired': 'A description is required.',
  'error.proofRequired': 'Closure proof is required before verification.',
  'error.selfVerification': 'An action cannot be verified by its own owner.',
  'error.offline': 'You are offline. New actions need a connection.',
  'error.assistantUnavailable': 'The assistant is unavailable. The event was not modified.',
  'error.notAllowedSite': 'You are not allowed to access this site.',

  'emergency.banner':
    'This application does not replace your site emergency procedures. Move to a safe place and follow the site emergency plan.',

  'empty.events': 'No safety event matches these filters.',
  'empty.actions': 'No corrective action to show.',
  'empty.instructions': 'No validated instruction is available for this search.',
  'empty.notifications': 'No new notifications.',
} as const;

export type TranslationKey = keyof typeof en;

/** Langue unique de l'interface. */
export const locale = 'en';

/** Retourne la chaine d'une cle ; la cle est affichee si elle est absente. */
export function t(key: TranslationKey): string {
  return en[key];
}
