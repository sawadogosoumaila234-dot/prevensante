-- migration 0001 — extensions et enums — <source: section 5.3>
-- Le schema "extensions" doit exister avant d'y installer les extensions.
create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "pg_cron" with schema extensions;
create extension if not exists "pg_net" with schema extensions;

create type public.app_role as enum (
  'worker','supervisor','hse_officer','maintenance_lead','action_owner',
  'occupational_physician','site_director','admin'
);

create type public.business_sector as enum (
  'mining','quarry','cement','manufacturing','metalworking',
  'food_processing','construction','logistics'
);

create type public.event_kind as enum ('danger','incident','accident');

create type public.event_status as enum (
  'submitted','under_review','triaged','in_progress',
  'awaiting_verification','closed','rejected','escalated'
);

create type public.severity_level as enum ('low','medium','high','critical');

create type public.zone_type as enum (
  'workshop','mine_area','quarry_area','plant_unit',
  'construction_site','warehouse_area','yard_area'
);

create type public.action_status as enum (
  'to_do','in_progress','to_verify','closed','cancelled'
);

create type public.escalation_level as enum (
  'hse_officer','site_director','company_officer'
);

create type public.ai_proposal_status as enum (
  'pending_review','accepted','rejected','expired'
);

create type public.document_status as enum (
  'draft','in_validation','validated','archived'
);

create type public.outbox_status as enum ('queued','sent','failed','skipped');

create type public.notification_severity as enum (
  'info','success','warning','critical'
);

create type public.log_action as enum (
  'created','updated','status_changed','assigned','commented',
  'proposed','validated','rejected','closed','escalated'
);

create type public.medical_visibility as enum (
  'physician_only','hse_anonymised','none'
);

create sequence public.event_ref_seq as bigint start 1;
create sequence public.action_ref_seq as bigint start 1;
