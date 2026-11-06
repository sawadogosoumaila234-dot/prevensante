-- migration 0004 — signalements, dossiers d'evenements et historique — <source: section 5.3>
create table public.safety_events (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  kind                public.event_kind not null,
  status              public.event_status not null default 'submitted',
  severity            public.severity_level not null default 'medium',
  site_id             uuid not null references public.sites(id) on delete restrict,
  zone_id             uuid references public.zones(id) on delete set null,
  equipment_id        uuid references public.equipments(id) on delete set null,
  risk_category_id    uuid references public.risk_categories(id) on delete set null,
  occurred_at         timestamptz not null,
  reported_at         timestamptz not null default now(),
  activity            text,
  description         text not null,
  immediate_measures  text,
  reported_consequences text,
  work_stoppage       boolean not null default false,
  injury_reported     boolean not null default false,
  photo_paths         text[] not null default '{}',
  reporter_id         uuid references public.profiles(id) on delete set null,
  is_anonymous        boolean not null default false,
  triaged_by          uuid references public.profiles(id) on delete set null,
  triaged_at          timestamptz,
  acknowledged_at     timestamptz,
  closed_by           uuid references public.profiles(id) on delete set null,
  closed_at           timestamptz,
  closure_note        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint safety_events_closed_check check (
    status <> 'closed' or (closed_by is not null and closed_at is not null and closure_note is not null)
  ),
  constraint safety_events_rejected_check check (
    status <> 'rejected' or closure_note is not null
  ),
  constraint safety_events_accident_check check (
    kind <> 'accident' or injury_reported or work_stoppage
  )
);
create index safety_events_site_status_idx on public.safety_events (site_id, status);
create index safety_events_kind_severity_idx on public.safety_events (kind, severity);
create index safety_events_zone_idx on public.safety_events (zone_id);
create index safety_events_equipment_idx on public.safety_events (equipment_id);
create index safety_events_occurred_idx on public.safety_events (occurred_at desc);
create index safety_events_reporter_idx on public.safety_events (reporter_id);
create index safety_events_open_idx on public.safety_events (status)
  where status in ('submitted','under_review','triaged','in_progress','awaiting_verification','escalated');

create table public.safety_event_logs (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.safety_events(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_role  public.app_role,
  action      public.log_action not null,
  field_name  text,
  old_value   text,
  new_value   text,
  note        text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index safety_event_logs_event_idx on public.safety_event_logs (event_id, created_at);
create index safety_event_logs_actor_idx on public.safety_event_logs (actor_id, created_at desc);

alter table public.safety_events     enable row level security;
alter table public.safety_event_logs enable row level security;
