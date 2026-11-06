-- migration 0015 — vues — <source: section 8.3>
create or replace view public.v_events_operational
with (security_invoker = true) as
select e.id,
       e.reference,
       e.kind,
       e.status,
       e.severity,
       e.site_id,
       e.zone_id,
       e.equipment_id,
       e.risk_category_id,
       e.occurred_at,
       e.reported_at,
       e.activity,
       e.description,
       e.immediate_measures,
       e.reported_consequences,
       e.work_stoppage,
       e.injury_reported,
       e.photo_paths,
       e.is_anonymous,
       case when e.is_anonymous then null else e.reporter_id end as reporter_id,
       e.triaged_by,
       e.triaged_at,
       e.closed_at
from public.safety_events e;

create or replace view public.v_overdue_actions
with (security_invoker = true) as
select a.id,
       a.reference,
       a.event_id,
       a.title,
       a.owner_id,
       a.status,
       a.due_at,
       a.severity,
       floor(extract(epoch from (now() - a.due_at)) / 86400)::int as overdue_days
from public.corrective_actions a
where a.status in ('to_do','in_progress','to_verify')
  and a.due_at < now();

create or replace view public.v_dashboard_kpi
with (security_invoker = true) as
select e.site_id,
       e.kind,
       e.status,
       e.severity,
       count(*)::int as events,
       avg(extract(epoch from (e.triaged_at - e.reported_at)) / 3600)
         filter (where e.triaged_at is not null) as avg_hours_to_triage,
       avg(extract(epoch from (e.closed_at - e.reported_at)) / 3600)
         filter (where e.closed_at is not null) as avg_hours_to_close
from public.safety_events e
group by e.site_id, e.kind, e.status, e.severity;

create or replace view public.v_recurrent_risks
with (security_invoker = true) as
select e.site_id,
       e.zone_id,
       e.equipment_id,
       e.risk_category_id,
       count(*)::int as occurrences,
       count(*) filter (where e.kind = 'accident')::int as accidents
from public.safety_events e
where e.reported_at >= now() - interval '180 days'
  and e.status <> 'rejected'
group by e.site_id, e.zone_id, e.equipment_id, e.risk_category_id
having count(*) >= 3;

create or replace view public.v_medical_summary
with (security_invoker = true) as
select m.id,
       m.event_id,
       m.injury_type,
       m.body_part,
       m.fitness_return,
       m.recorded_at
from public.medical_records m
where m.visibility in ('physician_only','hse_anonymised');

create or replace view public.v_accident_rate
with (security_invoker = true) as
select h.site_id,
       h.period_start,
       h.hours,
       (select count(*)::int from public.safety_events e
         where e.site_id = h.site_id
           and e.kind = 'accident'
           and e.reported_at >= h.period_start
           and e.reported_at < (h.period_start + interval '1 month')) as accidents
from public.site_worked_hours h;
