import { z } from 'zod';

/**
 * Schema de validation du signalement (react-hook-form + zod).
 * La description exige 20 caracteres minimum (section 11.3).
 */
export const reportSchema = z.object({
  kind: z.enum(['danger', 'incident', 'accident']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  site_id: z.string().min(1, 'This field is required.'),
  zone_id: z.string().min(1, 'This field is required.'),
  equipment_id: z.string().optional(),
  risk_category_id: z.string().optional(),
  occurred_at: z.string().min(1, 'This field is required.'),
  activity: z.string().min(3, 'This field is required.'),
  description: z
    .string()
    .min(20, 'A description is required.')
    .max(2000, 'The description is too long.'),
  immediate_measures: z.string().min(3, 'This field is required.'),
  reported_consequences: z.string().min(3, 'This field is required.'),
  work_stoppage: z.boolean(),
  injury_reported: z.boolean(),
  is_anonymous: z.boolean(),
  severity_immediate: z.boolean(),
});

export type ReportFormValues = z.infer<typeof reportSchema>;

export const REPORT_STEPS = ['Where', 'What', 'Evidence', 'Confirmation'] as const;
