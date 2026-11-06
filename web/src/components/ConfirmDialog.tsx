import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Libelle explicite de l'action, par exemple « Reject closure proof ». */
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Un motif est obligatoire lorsque `reasonRequired` est vrai. */
  reasonRequired?: boolean;
  reasonLabel?: string;
  description?: string;
  busy?: boolean;
  /** Contenu additionnel du dialogue (champs de saisie complementaires). */
  children?: ReactNode;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Dialogue de confirmation pour action destructive (section 13.3).
 * Le motif est obligatoire si la regle l'exige (rejet d'une preuve).
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = true,
  reasonRequired = false,
  reasonLabel = 'Reason',
  description,
  busy = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);

  const submit = () => {
    if (reasonRequired && reason.trim().length === 0) {
      setError('A reason is required.');
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={submit} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p>{description}</p> : null}
      {children}
      {reasonRequired ? (
        <div className="field">
          <label htmlFor="confirm-reason">
            {reasonLabel} <span className="req" aria-hidden="true">*</span>
          </label>
          <textarea
            id="confirm-reason"
            className="textarea"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'confirm-reason-error' : undefined}
          />
          {error ? (
            <p className="error-text" id="confirm-reason-error">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
