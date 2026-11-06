-- migration 0009 — audit et parametres applicatifs — <source: section 5.3>
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_role  public.app_role,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.audit_log    enable row level security;
alter table public.app_settings enable row level security;
