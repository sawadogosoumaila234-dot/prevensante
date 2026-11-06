// Environnement local partage (PGlite) pour PrevEnSante.
//
// ⚠️ ÉMULATION LOCALE UNIQUEMENT — aucun de ces objets n'est versionné dans
//    les migrations. PGlite (PostgreSQL en WebAssembly) ne fournit pas les
//    schémas `auth` et `storage` de Supabase, ni les extensions `pg_cron` et
//    `pg_net`. Ce module est le point d'entrée UNIQUE de cette émulation :
//    `tools/executer-migrations.mjs` (validation des migrations) et
//    `tools/test-fonctionnel.mjs` (tests RLS) l'importent tous les deux, afin
//    que le test s'exécute exactement sur le même schéma que l'exécuteur.

// Extensions requises par Supabase en production mais absentes de PGlite.
// Elles restent dans les migrations versionnees (0001) ; seule l'execution
// locale les ignore.
export const EXTENSIONS_INDISPONIBLES_PGLITE = ['pg_cron', 'pg_net'];

export const MESSAGE_EXTENSION_IGNOREE =
  'extension non disponible dans PGlite — ignoree pour la validation locale';

// ── Emulation locale de ce que fournit Supabase ───────────────────────────
export const SQL_ENVIRONNEMENT_LOCAL = `
  -- Supabase installe ses extensions dans le schema « extensions »
  create schema if not exists extensions;

  -- Auth : miroir du schema auth de Supabase.
  -- Le stub expose les colonnes que GoTrue lit dans des champs Go non
  -- nullables (instance_id, aud, role, confirmation_token, recovery_token,
  -- email_change...) et la table auth.identities, avec les memes valeurs
  -- par defaut que l'instance reelle. Les migrations 0016 a 0020 s'appuient
  -- sur ces colonnes : sans ce miroir, la validation locale n'exercerait pas
  -- le meme chemin de code que l'instance reelle.
  create schema if not exists auth;
  create table if not exists auth.users (
    instance_id uuid,
    id uuid primary key default gen_random_uuid(),
    aud varchar(255),
    role varchar(255),
    email varchar(255),
    encrypted_password varchar(255),
    email_confirmed_at timestamptz,
    invited_at timestamptz,
    confirmation_token varchar(255),
    confirmation_sent_at timestamptz,
    recovery_token varchar(255),
    recovery_sent_at timestamptz,
    email_change_token_current varchar(255) default '',
    email_change_token_new varchar(255),
    email_change varchar(255),
    email_change_sent_at timestamptz,
    email_change_confirm_status smallint default 0,
    phone_change varchar(15) default '',
    phone_change_token varchar(255) default '',
    phone_change_sent_at timestamptz,
    reauthentication_token varchar(255) default '',
    reauthentication_sent_at timestamptz,
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb default '{}'::jsonb,
    is_super_admin boolean,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    phone text,
    phone_confirmed_at timestamptz,
    confirmed_at timestamptz,
    banned_until timestamptz,
    deleted_at timestamptz,
    is_sso_user boolean not null default false,
    is_anonymous boolean not null default false
  );
  -- Sur Supabase, auth.identities.email est une colonne generee depuis
  -- identity_data ; l'unicite porte sur (provider_id, provider).
  create table if not exists auth.identities (
    provider_id text not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    identity_data jsonb not null,
    provider text not null,
    last_sign_in_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    email text generated always as (lower(identity_data ->> 'email')) stored,
    id uuid primary key default gen_random_uuid(),
    constraint identities_provider_id_provider_unique unique (provider_id, provider)
  );
  create or replace function auth.uid() returns uuid
    language sql stable as $$
      select coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
        nullif(current_setting('request.jwt.claim.sub', true), '')
      )::uuid
    $$;

  -- Storage minimal : buckets + objects + foldername()
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key,
    name text not null unique,
    public boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text not null,
    owner uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    metadata jsonb default '{}'::jsonb
  );
  create index if not exists storage_objects_bucket_idx on storage.objects (bucket_id, name);
  create or replace function storage.foldername(name text) returns text[]
    language sql immutable as $$ select string_to_array(name, '/') $$;

  -- Roles Supabase
  create role authenticated nologin;
  create role anon nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, storage, extensions, auth
    to authenticated, anon, service_role;
`;

// Prepare l'environnement local (schemas extensions/auth/storage, roles,
// auth.uid(), tables minimales). Idempotent.
export async function preparerEnvironnementLocal(db) {
  await db.exec(SQL_ENVIRONNEMENT_LOCAL);
}

// Retourne le nom de l'extension si l'instruction est un « create extension »
// portant sur une extension indisponible dans PGlite (pg_cron, pg_net).
export function extensionIndisponibleLocale(instruction) {
  const m = instruction.match(
    /create\s+extension\s+(?:if\s+not\s+exists\s+)?["']?([a-z0-9_]+)/i
  );
  if (!m) return null;
  const nom = m[1].toLowerCase();
  return EXTENSIONS_INDISPONIBLES_PGLITE.includes(nom) ? nom : null;
}
