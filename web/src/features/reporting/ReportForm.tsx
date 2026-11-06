import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/SessionProvider';
import { Button } from '../../components/Button';
import { Alert } from '../../components/Alert';
import { FormField } from '../../components/FormField';
import { PhotoUploader } from '../../components/PhotoUploader';
import { EmergencyNotice } from '../../components/EmergencyNotice';
import { listEquipments, listRiskCategories, listSites, listZones } from '../../lib/api';
import { createSafetyEvent } from '../../lib/mutations';
import { clearDraft, loadDraft, saveDraft } from '../../lib/draft';
import { useOnline } from '../../lib/hooks';
import { kindLabel } from '../../lib/i18n/labels';
import { t } from '../../lib/i18n/en';
import { reportSchema, REPORT_STEPS, type ReportFormValues } from './reportSchema';
import type { CompressedPhoto } from '../../lib/photo';

/**
 * Formulaire de signalement en 4 etapes : Where -> What -> Evidence ->
 * Confirmation (section 11.3).
 */
export default function ReportForm() {
  const { kind } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const online = useOnline();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<CompressedPhoto[]>([]);
  const [networkError, setNetworkError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    mode: 'onBlur',
    defaultValues: {
      kind: kind === 'incident' || kind === 'accident' ? kind : 'danger',
      severity: kind === 'danger' ? 'critical' : kind === 'accident' ? 'high' : 'medium',
      site_id: user?.site_id ?? '',
      zone_id: '',
      equipment_id: '',
      risk_category_id: '',
      occurred_at: new Date().toISOString().slice(0, 16),
      activity: '',
      description: '',
      immediate_measures: '',
      reported_consequences: '',
      work_stoppage: false,
      injury_reported: false,
      is_anonymous: false,
      severity_immediate: false,
    },
  });

  // Restauration d'un brouillon local en cas d'echec reseau precedent.
  useEffect(() => {
    const draft = loadDraft();
    if (draft && draft.description) {
      setValue('site_id', draft.site_id);
      setValue('zone_id', draft.zone_id);
      setValue('equipment_id', draft.equipment_id);
      setValue('risk_category_id', draft.risk_category_id);
      setValue('activity', draft.activity);
      setValue('description', draft.description);
      setValue('immediate_measures', draft.immediate_measures);
      setValue('reported_consequences', draft.reported_consequences);
      setValue('work_stoppage', draft.work_stoppage);
      setValue('injury_reported', draft.injury_reported);
      setValue('is_anonymous', draft.is_anonymous);
      setValue('severity_immediate', draft.severity_immediate);
      setDraftRestored(true);
    }
  }, [setValue]);

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites, staleTime: 60_000 });
  const { data: zones } = useQuery({
    queryKey: ['zones', watch('site_id')],
    queryFn: () => listZones(watch('site_id') || undefined),
    enabled: Boolean(watch('site_id')),
    staleTime: 60_000,
  });
  const { data: equipments } = useQuery({
    queryKey: ['equipments', watch('site_id'), watch('zone_id')],
    queryFn: () => listEquipments(watch('site_id') || undefined, watch('zone_id') || undefined),
    enabled: Boolean(watch('site_id') && watch('zone_id')),
    staleTime: 60_000,
  });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listRiskCategories(),
    staleTime: 60_000,
  });

  const values = watch();
  const isDangerCritical = values.kind === 'danger' && values.severity_immediate;

  const mutation = useMutation({
    mutationFn: async () => {
      const event = await createSafetyEvent({
        kind: values.kind,
        severity: values.severity,
        site_id: values.site_id,
        zone_id: values.zone_id || null,
        equipment_id: values.equipment_id || null,
        risk_category_id: values.risk_category_id || null,
        occurred_at: new Date(values.occurred_at).toISOString(),
        activity: values.activity,
        description: values.description,
        immediate_measures: values.immediate_measures,
        reported_consequences: values.reported_consequences,
        work_stoppage: values.work_stoppage,
        injury_reported: values.injury_reported,
        is_anonymous: values.is_anonymous,
        photo_paths: photos.map((p) => p.dataUrl),
        reporter_id: values.is_anonymous ? null : (user?.id ?? null),
      });
      return event;
    },
    onSuccess: (event) => {
      clearDraft();
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate('/report/success', { state: { reference: event.reference, anonymous: event.is_anonymous, kind: event.kind } });
    },
    onError: () => {
      setNetworkError('Network unavailable. Your draft is saved on this device.');
      saveDraft({
        kind: values.kind,
        site_id: values.site_id,
        zone_id: values.zone_id,
        equipment_id: values.equipment_id ?? '',
        risk_category_id: values.risk_category_id ?? '',
        activity: values.activity,
        description: values.description,
        immediate_measures: values.immediate_measures,
        reported_consequences: values.reported_consequences,
        work_stoppage: values.work_stoppage,
        injury_reported: values.injury_reported,
        is_anonymous: values.is_anonymous,
        severity_immediate: values.severity_immediate,
        photos: photos.map((p) => ({ id: p.id, dataUrl: p.dataUrl, name: p.name })),
        updated_at: new Date().toISOString(),
      });
    },
  });

  const stepFields: (keyof ReportFormValues)[][] = [
    ['site_id', 'zone_id', 'equipment_id', 'occurred_at'],
    ['kind', 'severity', 'activity', 'description', 'immediate_measures', 'reported_consequences'],
    ['risk_category_id', 'work_stoppage', 'injury_reported', 'is_anonymous'],
    [],
  ];

  const goNext = async () => {
    const fields = stepFields[step] as (keyof ReportFormValues)[];
    if (fields.length === 0) {
      setStep((s) => s + 1);
      return;
    }
    const valid = await trigger(fields, { shouldFocus: true });
    if (valid) setStep((s) => Math.min(REPORT_STEPS.length - 1, s + 1));
  };

  const siteOptions = useMemo(
    () => (sites ?? []).filter((s) => s.is_active),
    [sites],
  );

  return (
    <>
      {isDangerCritical ? <EmergencyNotice /> : null}

      <div className="page-head">
        <h1>{t('nav.report')}</h1>
        <p className="sub">
          {kindLabel(values.kind)} — {REPORT_STEPS[step]} (step {step + 1} of {REPORT_STEPS.length})
        </p>
      </div>

      <ol className="steps" style={{ listStyle: 'none', padding: 0 }}>
        {REPORT_STEPS.map((label, index) => (
          <li
            key={label}
            className={`step${index === step ? ' current' : ''}${index < step ? ' done' : ''}`}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className="num" aria-hidden="true">
              {index < step ? '✔' : index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {draftRestored ? (
        <Alert tone="info" title="Draft restored">
          A draft saved on this device has been restored. Check it before submitting.
        </Alert>
      ) : null}
      {networkError ? (
        <Alert tone="danger" role="alert" title="Report not sent">
          {networkError}
        </Alert>
      ) : null}
      {!online ? (
        <Alert tone="warning" title="You are offline">
          You can review saved data, but new reports need a connection.
        </Alert>
      ) : null}

      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < REPORT_STEPS.length - 1) {
            void goNext();
            return;
          }
          void handleSubmit(() => mutation.mutate())();
        }}
        noValidate
      >
        {step === 0 ? (
          <>
            <h2 style={{ fontSize: 'var(--fs-18)' }}>Where</h2>
            <div className="form-grid">
              <FormField id="site_id" label="Site" required error={errors.site_id?.message}>
                <select className="select" {...register('site_id')}>
                  <option value="">Select a site</option>
                  {siteOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField id="zone_id" label="Zone" required error={errors.zone_id?.message}>
                <select className="select" {...register('zone_id')}>
                  <option value="">Select a zone</option>
                  {(zones ?? []).map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField id="equipment_id" label="Equipment" helper="Optional">
                <select className="select" {...register('equipment_id')}>
                  <option value="">No specific equipment</option>
                  {(equipments ?? []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.asset_code})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField id="occurred_at" label="Date and time observed" required error={errors.occurred_at?.message}>
                <input className="input" type="datetime-local" {...register('occurred_at')} />
              </FormField>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 style={{ fontSize: 'var(--fs-18)' }}>What</h2>
            <div className="form-grid">
              <FormField id="kind" label="Type of report" required error={errors.kind?.message}>
                <select className="select" {...register('kind')}>
                  <option value="danger">Danger</option>
                  <option value="incident">Incident</option>
                  <option value="accident">Accident</option>
                </select>
              </FormField>

              <FormField id="severity" label="Severity" required error={errors.severity?.message}>
                <select className="select" {...register('severity')}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </FormField>
            </div>

            <FormField id="activity" label="Activity at the time" required error={errors.activity?.message}>
              <input className="input" type="text" {...register('activity')} />
            </FormField>

            <FormField
              id="description"
              label="Description"
              required
              error={errors.description?.message}
              helper="Describe what you observed, in at least 20 characters."
              counter={{ current: values.description?.length ?? 0, max: 2000 }}
            >
              <textarea className="textarea" {...register('description')} />
            </FormField>

            <FormField
              id="immediate_measures"
              label="Immediate measures taken"
              required
              error={errors.immediate_measures?.message}
            >
              <textarea className="textarea" {...register('immediate_measures')} />
            </FormField>

            <FormField
              id="reported_consequences"
              label="Reported consequences"
              required
              error={errors.reported_consequences?.message}
              helper="Actual consequences, including « none » if there was no consequence."
            >
              <textarea className="textarea" {...register('reported_consequences')} />
            </FormField>

            <label className="checkbox-row">
              <input type="checkbox" {...register('severity_immediate')} />
              <span>
                <strong>The situation is an immediate danger.</strong>
                <span className="small muted" style={{ display: 'block' }}>
                  The confirmation step will remind you of the site emergency procedures.
                </span>
              </span>
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 style={{ fontSize: 'var(--fs-18)' }}>Evidence</h2>
            <FormField id="risk_category_id" label="Risk category" helper="Optional — the HSE officer confirms it during triage.">
              <select className="select" {...register('risk_category_id')}>
                <option value="">Not sure</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>

            <PhotoUploader photos={photos} onChange={setPhotos} />

            <label className="checkbox-row">
              <input type="checkbox" {...register('work_stoppage')} />
              <span>Work was stopped as a result</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" {...register('injury_reported')} />
              <span>An injury was reported</span>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" {...register('is_anonymous')} />
              <span>
                Submit anonymously
                <span className="small muted" style={{ display: 'block' }}>
                  Your identity is hidden from the safety team.
                </span>
              </span>
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 style={{ fontSize: 'var(--fs-18)' }}>Confirmation</h2>
            <dl className="dl-grid">
              <dt>Type</dt>
              <dd>{kindLabel(values.kind)}</dd>
              <dt>Site</dt>
              <dd>{siteOptions.find((s) => s.id === values.site_id)?.name ?? values.site_id}</dd>
              <dt>Zone</dt>
              <dd>{(zones ?? []).find((z) => z.id === values.zone_id)?.name ?? values.zone_id}</dd>
              <dt>Activity</dt>
              <dd>{values.activity}</dd>
              <dt>Description</dt>
              <dd>{values.description}</dd>
              <dt>Immediate measures</dt>
              <dd>{values.immediate_measures}</dd>
              <dt>Consequences</dt>
              <dd>{values.reported_consequences}</dd>
              <dt>Photos</dt>
              <dd>{photos.length}</dd>
              <dt>Anonymous</dt>
              <dd>{values.is_anonymous ? 'Yes' : 'No'}</dd>
            </dl>
            {isDangerCritical ? <EmergencyNotice /> : null}
          </>
        ) : null}

        <div className="btn-row bottom-fixed">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => navigate('/my-reports')}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              saveDraft({
                kind: values.kind,
                site_id: values.site_id,
                zone_id: values.zone_id,
                equipment_id: values.equipment_id ?? '',
                risk_category_id: values.risk_category_id ?? '',
                activity: values.activity,
                description: values.description,
                immediate_measures: values.immediate_measures,
                reported_consequences: values.reported_consequences,
                work_stoppage: values.work_stoppage,
                injury_reported: values.injury_reported,
                is_anonymous: values.is_anonymous,
                severity_immediate: values.severity_immediate,
                photos: photos.map((p) => ({ id: p.id, dataUrl: p.dataUrl, name: p.name })),
                updated_at: new Date().toISOString(),
              });
              setStep(0);
            }}
          >
            Save draft
          </Button>
          {step < REPORT_STEPS.length - 1 ? (
            // `key` distinct : sans lui React reutilise le meme noeud DOM et
            // lui change son attribut `type` de "button" a "submit" pendant le
            // clic. Le navigateur execute alors le comportement par defaut du
            // bouton et soumet le formulaire : l'etape Confirmation etait
            // sautee et le signalement partait sans relecture.
            <Button key="continue" onClick={() => void goNext()}>
              Continue
            </Button>
          ) : (
            <Button key="submit" type="submit" loading={isSubmitting || mutation.isPending}>
              {t('action.submitReport')}
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
