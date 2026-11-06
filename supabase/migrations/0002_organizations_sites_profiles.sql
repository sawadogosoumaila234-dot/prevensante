-- migration 0002 — organisations, sites, comptes — <source: section 5.3>
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sector      public.business_sector not null,
  country     text not null default 'Burkina Faso',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.sites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  code            text,
  sector          public.business_sector not null,
  address         text,
  emergency_contact text,
  is_pilot        boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint sites_org_code_key unique (organization_id, code)
);
create index sites_organization_idx on public.sites (organization_id);
create index sites_sector_idx on public.sites (sector);

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null,
  email           text,
  phone           text,
  role            public.app_role not null default 'worker',
  organization_id uuid references public.organizations(id) on delete set null,
  site_id         uuid references public.sites(id) on delete set null,
  job_title       text,
  is_medical_authorized boolean not null default false,
  is_active       boolean not null default true,
  locale          text not null default 'en',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index profiles_site_idx on public.profiles (site_id);
create index profiles_role_idx on public.profiles (role);
create index profiles_organization_idx on public.profiles (organization_id);

alter table public.organizations enable row level security;
alter table public.sites         enable row level security;
alter table public.profiles      enable row level security;
