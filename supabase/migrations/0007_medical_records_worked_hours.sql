-- migration 0007 — donnees de sante isolees et heures travaillees — <source: section 5.3>
create table public.medical_records (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.safety_events(id) on delete cascade,
  subject_id      uuid references public.profiles(id) on delete set null,
  visibility      public.medical_visibility not null default 'physician_only',
  injury_type     text,
  body_part       text,
  care_given      text,
  fitness_return  text,
  recorded_by     uuid references public.profiles(id) on delete set null,
  recorded_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint medical_records_subject_check check (
    visibility <> 'physician_only' or subject_id is not null
  )
);
create index medical_records_event_idx on public.medical_records (event_id);
create index medical_records_subject_idx on public.medical_records (subject_id);

create table public.site_worked_hours (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references public.sites(id) on delete cascade,
  period_start  date not null,
  hours         numeric(10,1) not null default 0,
  source        text not null default 'manual',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint site_worked_hours_period_key unique (site_id, period_start),
  constraint site_worked_hours_hours_check check (hours >= 0 and hours <= 100000)
);
create index site_worked_hours_site_idx on public.site_worked_hours (site_id, period_start desc);

alter table public.medical_records    enable row level security;
alter table public.site_worked_hours  enable row level security;
