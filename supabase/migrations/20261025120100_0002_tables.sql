-- =============================================================================
-- PrevEnSanté — 0002 : tables du schéma `app` (sécurité) et `medical` (santé)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Référentiels : secteurs, sites, zones
-- -----------------------------------------------------------------------------

create table app.secteurs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  libelle     text not null,
  description text,
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table app.sites (
  id          uuid primary key default gen_random_uuid(),
  secteur_id  uuid not null references app.secteurs(id) on delete restrict,
  code        text not null unique,
  nom         text not null,
  description text,
  -- Centre géographique, utilisé pour la carte et la géolocalisation.
  localisation geography(point, 4326),
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);

create index sites_secteur_idx on app.sites (secteur_id);
create index sites_localisation_idx on app.sites using gist (localisation);

create table app.zones (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references app.sites(id) on delete cascade,
  code        text not null,
  nom         text not null,
  description text,
  created_at  timestamptz not null default now(),
  unique (site_id, code)
);

create index zones_site_idx on app.zones (site_id);

-- -----------------------------------------------------------------------------
-- Comptes et rôles
-- -----------------------------------------------------------------------------

-- Le profil est lié 1-1 à un compte Supabase Auth.
create table app.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nom         text not null,
  prenom      text,
  telephone   text,
  role_acteur app.role_acteur not null default 'travailleur',
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un utilisateur peut être rattaché à plusieurs sites (multi-sites / multi-secteurs).
create table app.profile_sites (
  profile_id uuid not null references app.profiles(id) on delete cascade,
  site_id    uuid not null references app.sites(id) on delete cascade,
  primary key (profile_id, site_id)
);

create index profile_sites_site_idx on app.profile_sites (site_id);

-- -----------------------------------------------------------------------------
-- Signalements (PRD F2 / F3)
-- -----------------------------------------------------------------------------

create table app.signalements (
  id              uuid primary key default gen_random_uuid(),
  -- Identifiant métier lisible, format SIG-2026-0001.
  -- Renseigné par trigger (une colonne GENERATED ne peut pas appeler nextval/to_char,
  -- qui ne sont pas IMMUTABLE).
  reference       text unique,
  type_evenement  app.type_evenement not null,
  site_id         uuid not null references app.sites(id) on delete restrict,
  zone_id         uuid references app.zones(id) on delete set null,
  categorie       app.categorie_risque,
  priorite        app.niveau_priorite not null default 'moyenne',
  statut          app.statut_signalement not null default 'nouveau',

  titre           text not null,
  description     text not null,
  activite_en_cours text,
  equipement_concerne text,
  mesures_immediates text,

  -- Signalement effectué par un utilisateur de app.profiles.
  auteur_id       uuid references app.profiles(id) on delete set null,
  -- Anonyme autorisé : certains terrains refusent l'identification nominative.
  anonyme         boolean not null default false,

  -- Horodatage de l'événement (peut précéder la saisie) et de la déclaration.
  evenement_at    timestamptz not null default now(),
  declare_at      timestamptz not null default now(),

  -- Géolocalisation de l'événement.
  localisation    geography(point, 4326),

  -- Clé de déduplication pour le mode hors ligne : le client génère l'uuid.
  client_uuid     uuid,
  -- Contrôle de concurrence optimiste (file d'attente hors ligne).
  version         integer not null default 1,

  cloture_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint signalements_client_uuid_unique unique (client_uuid),
  constraint signalements_cloture_check check (
    (statut = 'clos' and cloture_at is not null) or (statut <> 'clos')
  )
);

create sequence app.signalements_seq start 1;

-- Attribution de la référence métier à l'insertion.
create or replace function app.assigner_reference_signalement()
returns trigger
language plpgsql as $$
begin
  if new.reference is null then
    new.reference := 'SIG-' || to_char(new.created_at, 'YYYY') || '-' ||
                     lpad(nextval('app.signalements_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger signalements_reference before insert on app.signalements
  for each row execute function app.assigner_reference_signalement();

create index signalements_site_idx       on app.signalements (site_id);
create index signalements_zone_idx       on app.signalements (zone_id);
create index signalements_statut_idx     on app.signalements (statut);
create index signalements_categorie_idx  on app.signalements (categorie);
create index signalements_evenement_idx  on app.signalements (evenement_at desc);
create index signalements_declare_idx    on app.signalements (declare_at desc);
create index signalements_localisation_idx on app.signalements using gist (localisation);
create index signalements_titre_trgm     on app.signalements using gin (titre gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Actions correctives (PRD F4)
-- -----------------------------------------------------------------------------

create table app.actions_correctives (
  id            uuid primary key default gen_random_uuid(),
  signalement_id uuid not null references app.signalements(id) on delete cascade,
  site_id       uuid not null references app.sites(id) on delete restrict,

  titre        text not null,
  description  text,
  responsable_id uuid references app.profiles(id) on delete set null,
  responsable_libelle text,   -- permet de nommer un responsable sans compte
  echeance_at  date,
  statut       app.statut_action not null default 'a_faire',
  avancement   smallint not null default 0 check (avancement between 0 and 100),

  -- Clôture soumise à vérification par une personne compétente (PRD F4).
  cloturee_par  uuid references app.profiles(id) on delete set null,
  cloturee_at   timestamptz,
  verification  text,

  client_uuid  uuid,
  version      integer not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint actions_cloture_check check (
    (statut = 'cloturee' and cloturee_at is not null) or (statut <> 'cloturee')
  ),
  constraint actions_client_uuid_unique unique (client_uuid)
);

create index actions_signalement_idx on app.actions_correctives (signalement_id);
create index actions_site_idx       on app.actions_correctives (site_id);
create index actions_statut_idx     on app.actions_correctives (statut);
create index actions_echeance_idx   on app.actions_correctives (echeance_at);

-- Actions en retard : échéance dépassée et non clôturée.
create index actions_retard_idx on app.actions_correctives (echeance_at)
  where statut <> 'cloturee' and echeance_at is not null;

-- -----------------------------------------------------------------------------
-- Pièces jointes (photos des signalements) — stockage Supabase Storage
-- -----------------------------------------------------------------------------

create table app.pieces_jointes (
  id            uuid primary key default gen_random_uuid(),
  signalement_id uuid not null references app.signalements(id) on delete cascade,
  nom_fichier   text not null,
  bucket        text not null default 'signalements',
  chemin        text not null,
  mime_type     text,
  taille_octets integer,
  created_at    timestamptz not null default now()
);

create index pieces_signalement_idx on app.pieces_jointes (signalement_id);

-- -----------------------------------------------------------------------------
-- Corpus de consignes validées + embeddings IA (PRD §9)
-- -----------------------------------------------------------------------------

create table app.consignes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,          -- C-042, C-118…
  titre        text not null,
  contenu      text not null,
  secteur_id   uuid references app.secteurs(id) on delete set null,
  categorie    app.categorie_risque,
  statut       app.statut_consigne not null default 'brouillon',
  validee_par  uuid references app.profiles(id) on delete set null,
  validee_at   timestamptz,
  version      integer not null default 1,
  embedding    vector(768),                    -- aligné sur le modèle d'embedding choisi
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index consignes_statut_idx  on app.consignes (statut);
create index consignes_secteur_idx on app.consignes (secteur_id);
create index consignes_embedding_idx on app.consignes using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Journal des modifications (traçabilité, PRD F3 : « les modifications sont
-- historisées »). Alimenté par trigger, en lecture seule côté application.
-- ---------------------------------------------------------------------------

create table app.journal_modifications (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  enregistrement_id uuid not null,
  operation   text not null check (operation in ('insert', 'update', 'delete')),
  ancien      jsonb,
  nouveau     jsonb,
  auteur_id   uuid references app.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index journal_table_idx  on app.journal_modifications (table_name, enregistrement_id);
create index journal_created_idx on app.journal_modifications (created_at desc);

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS (PRD F5)
-- -----------------------------------------------------------------------------

create table app.notifications (
  id           uuid primary key default gen_random_uuid(),
  destinataire_id uuid not null references app.profiles(id) on delete cascade,
  type         text not null,          -- signalement_cree, action_en_retard, action_cloturee…
  titre        text not null,
  corps        text,
  lien         text,
  lu           boolean not null default false,
  created_at   timestamptz not null default now()
);

create index notifications_destinataire_idx on app.notifications (destinataire_id, lu, created_at desc);

-- -----------------------------------------------------------------------------
-- RAPPORTS exportés
-- -----------------------------------------------------------------------------

create table app.rapports (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid references app.sites(id) on delete cascade,
  auteur_id  uuid references app.profiles(id) on delete set null,
  titre      text not null,
  type       text not null default 'periodique',  -- periodique, accident, personnalise
  parametres jsonb not null default '{}'::jsonb,
  fichier_url text,
  created_at timestamptz not null default now()
);

create index rapports_site_idx on app.rapports (site_id, created_at desc);

-- =============================================================================
-- SCHÉMA `medical` — données de santé, strictement séparées
-- =============================================================================

-- Rappel : aucune politique RLS de ce schéma n'est exposée au client web.
-- Seuls les comptes de rôle `medecin_du_travail` y accèdent, via la fonction
-- de service `app.acces_dossier_medical` (définie en 0004).
create table medical.dossiers (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references app.sites(id) on delete restrict,
  patient_id   uuid references app.profiles(id) on delete set null,
  type_dossier medical.type_dossier not null,
  date_admission date not null default current_date,
  -- Lien optionnel vers le signalement d'accident, SANS données de santé.
  signalement_id uuid references app.signalements(id) on delete set null,
  observations text,
  decisions    text,
  -- Chiffrement applicatif du contenu clinique (clé hors base, dans le coffre).
  contenu_chiffre bytea,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index dossiers_site_idx    on medical.dossiers (site_id);
create index dossiers_patient_idx on medical.dossiers (patient_id);
create index dossiers_signalement_idx on medical.dossiers (signalement_id);

-- Table de séparation : le lien accident <-> dossier médical.
-- Ne contient AUCUNE donnée de santé : uniquement des identifiants.
create table app.liaisons_accident_dossier (
  signalement_id uuid not null references app.signalements(id) on delete cascade,
  dossier_id     uuid not null references medical.dossiers(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (signalement_id, dossier_id)
);
