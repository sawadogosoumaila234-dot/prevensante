-- migration 0003 — zones, equipements, categories de risques — <source: section 5.3>
create table public.zones (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites(id) on delete cascade,
  name        text not null,
  type        public.zone_type not null,
  code        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint zones_site_name_key unique (site_id, name)
);
create index zones_site_idx on public.zones (site_id);

create table public.equipments (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  zone_id         uuid references public.zones(id) on delete set null,
  name            text not null,
  asset_code      text,
  equipment_type  text,
  is_critical     boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index equipments_site_idx on public.equipments (site_id);
create index equipments_zone_idx on public.equipments (zone_id);

create table public.risk_categories (
  id               uuid primary key default gen_random_uuid(),
  sector           public.business_sector not null,
  code             text not null,
  label            text not null,
  default_severity public.severity_level not null default 'medium',
  requires_equipment boolean not null default false,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint risk_categories_sector_code_key unique (sector, code)
);
create index risk_categories_sector_idx on public.risk_categories (sector);

alter table public.zones           enable row level security;
alter table public.equipments      enable row level security;
alter table public.risk_categories enable row level security;
