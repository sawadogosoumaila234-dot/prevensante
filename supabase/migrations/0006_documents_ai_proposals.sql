-- migration 0006 — corpus de consignes et propositions IA — <source: section 5.3>
create table public.safety_documents (
  id             uuid primary key default gen_random_uuid(),
  reference      text not null unique,
  title          text not null,
  sector         public.business_sector,
  scope_text     text,
  current_version int not null default 1,
  status         public.document_status not null default 'draft',
  validated_by   uuid references public.profiles(id) on delete set null,
  validated_at   timestamptz,
  review_due_at  date,
  file_path      text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint safety_documents_validated_check check (
    status <> 'validated' or (validated_by is not null and validated_at is not null)
  )
);
create index safety_documents_sector_idx on public.safety_documents (sector);
create index safety_documents_status_idx on public.safety_documents (status);

create table public.document_versions (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.safety_documents(id) on delete cascade,
  version        int not null,
  change_summary text,
  file_path      text not null,
  author_id      uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint document_versions_unique unique (document_id, version)
);
create index document_versions_document_idx on public.document_versions (document_id, version desc);

create table public.ai_proposals (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid references public.safety_events(id) on delete cascade,
  asked_by              uuid references public.profiles(id) on delete set null,
  proposal_type         text not null,
  model_name            text not null default 'rule-assist-v1',
  suggested_category_id uuid references public.risk_categories(id) on delete set null,
  suggested_severity    public.severity_level,
  suggested_document_id uuid references public.safety_documents(id) on delete set null,
  confidence            numeric(4,3),
  rationale             text,
  "references"          text[] not null default '{}',
  limitations           text,
  status                public.ai_proposal_status not null default 'pending_review',
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  review_note           text,
  applied_at            timestamptz,
  created_at            timestamptz not null default now(),
  constraint ai_proposals_type_check check (
    proposal_type in ('classification','instruction_lookup')
  ),
  constraint ai_proposals_confidence_check check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  ),
  constraint ai_proposals_reviewed_check check (
    status = 'pending_review' or reviewed_by is not null
  ),
  constraint ai_proposals_applied_check check (
    applied_at is null or (reviewed_by is not null and status = 'accepted')
  )
);
create index ai_proposals_event_idx on public.ai_proposals (event_id);
create index ai_proposals_status_idx on public.ai_proposals (status, created_at desc);
create index ai_proposals_asked_by_idx on public.ai_proposals (asked_by, created_at desc);

alter table public.safety_documents enable row level security;
alter table public.document_versions  enable row level security;
alter table public.ai_proposals       enable row level security;
