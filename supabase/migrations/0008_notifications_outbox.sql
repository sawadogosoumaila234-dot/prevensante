-- migration 0008 — notifications et files d'envoi — <source: section 5.3>
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  event_id    uuid references public.safety_events(id) on delete cascade,
  action_id   uuid references public.corrective_actions(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text not null,
  severity    public.notification_severity not null default 'info',
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.email_outbox (
  id                  uuid primary key default gen_random_uuid(),
  template            text not null,
  to_email            text not null,
  recipient_name      text,
  subject             text not null,
  body                text not null,
  payload             jsonb not null default '{}'::jsonb,
  status              public.outbox_status not null default 'queued',
  attempts            int not null default 0,
  provider_message_id text,
  last_error          text,
  scheduled_at        timestamptz not null default now(),
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);
create index email_outbox_pending_idx on public.email_outbox (status, scheduled_at)
  where status = 'queued';

create table public.sms_outbox (
  id          uuid primary key default gen_random_uuid(),
  to_phone    text not null,
  body        text not null,
  payload     jsonb not null default '{}'::jsonb,
  status      public.outbox_status not null default 'queued',
  attempts    int not null default 0,
  last_error  text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index sms_outbox_pending_idx on public.sms_outbox (status, created_at)
  where status = 'queued';

alter table public.notifications  enable row level security;
alter table public.email_outbox  enable row level security;
alter table public.sms_outbox    enable row level security;
