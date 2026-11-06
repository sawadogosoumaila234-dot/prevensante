-- migration 0005 — actions correctives et escalades — <source: section 5.3>
create table public.corrective_actions (
  id                            uuid primary key default gen_random_uuid(),
  reference                     text not null unique,
  event_id                      uuid not null references public.safety_events(id) on delete cascade,
  title                         text not null,
  description                   text,
  owner_id                      uuid references public.profiles(id) on delete set null,
  owner_role                    public.app_role,
  status                        public.action_status not null default 'to_do',
  severity                      public.severity_level not null default 'medium',
  due_at                        timestamptz not null,
  started_at                    timestamptz,
  submitted_for_verification_at timestamptz,
  closed_at                     timestamptz,
  closed_by                     uuid references public.profiles(id) on delete set null,
  closure_evidence_path         text,
  closure_note                  text,
  verified_by                   uuid references public.profiles(id) on delete set null,
  verified_at                   timestamptz,
  reopen_count                  int not null default 0,
  created_by                    uuid references public.profiles(id) on delete set null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint corrective_actions_verification_check check (
    status <> 'to_verify' or submitted_for_verification_at is not null
  ),
  constraint corrective_actions_closure_check check (
    status <> 'closed' or (
      closed_at is not null and closed_by is not null
      and closure_evidence_path is not null
      and verified_by is not null and verified_at is not null
    )
  )
);
create index corrective_actions_event_idx on public.corrective_actions (event_id);
create index corrective_actions_owner_status_idx on public.corrective_actions (owner_id, status);
create index corrective_actions_due_open_idx on public.corrective_actions (due_at)
  where status in ('to_do','in_progress','to_verify');
-- correction : un predicat d'index PostgreSQL doit etre IMMUTABLE ; now() ne l'est pas.
-- La partie "echeance depassee" est portee par la vue public.v_overdue_actions.
create index corrective_actions_overdue_idx on public.corrective_actions (due_at)
  where status in ('to_do','in_progress');

create table public.escalations (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.safety_events(id) on delete cascade,
  level              public.escalation_level not null,
  reason             text not null,
  triggered_by       uuid references public.profiles(id) on delete set null,
  notified_role      public.app_role not null,
  notified_user_id   uuid references public.profiles(id) on delete set null,
  acknowledged_by    uuid references public.profiles(id) on delete set null,
  acknowledged_at    timestamptz,
  channel            text not null default 'in_app',
  created_at         timestamptz not null default now()
);
create index escalations_event_idx on public.escalations (event_id, created_at desc);
create index escalations_open_idx on public.escalations (notified_user_id)
  where acknowledged_at is null;

alter table public.corrective_actions enable row level security;
alter table public.escalations       enable row level security;
