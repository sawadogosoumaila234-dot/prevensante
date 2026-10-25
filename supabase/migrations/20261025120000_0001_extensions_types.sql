-- =============================================================================
-- PrevEnSanté — 0001 : extensions, schémas, types énumérés
-- =============================================================================

create extension if not exists "pgcrypto";        -- gen_random_uuid()
create extension if not exists "pg_trgm";         -- recherche floue (signalements, consignes)
create extension if not exists "vector";          -- pgvector : embeddings du corpus IA
create extension if not exists "postgis";         -- géolocalisation des signalements

-- Schéma applicatif principal : données de sécurité (non médicales)
create schema if not exists app;

-- Schéma strictement séparé : données de santé et médecine du travail.
-- Aucune politique RLS de ce schéma n'est accessible au rôle web public :
-- l'accès passe par la fonction de service `medecin_du_travail`.
create schema if not exists medical;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------

-- Rôles applicatifs (PRD §5). Le rôle est stocké dans auth.users via app.profiles,
-- mais l'énumération sert aussi de référence pour les politiques RLS.
create type app.role_acteur as enum (
  'travailleur',
  'chef_equipe',
  'responsable_hse',
  'responsable_maintenance',
  'medecin_du_travail',
  'directeur_site',
  'administrateur'
);

-- Type d'événement (PRD F2) : danger non réalisé, incident, accident réalisé.
create type app.type_evenement as enum (
  'danger',
  'incident',
  'accident'
);

-- Statut de traitement d'un signalement (PRD F3).
create type app.statut_signalement as enum (
  'nouveau',
  'en_qualification',
  'qualifie',
  'en_traitement',
  'clos',
  'rejete'
);

-- Statut d'une action corrective (PRD F4).
create type app.statut_action as enum (
  'a_faire',
  'en_cours',
  'a_verifier',
  'cloturee'
);

-- Niveaux de priorité.
create type app.niveau_priorite as enum (
  'critique',
  'elevee',
  'moyenne',
  'faible'
);

-- Catégories de risques, adaptées par secteur (PRD F2).
create type app.categorie_risque as enum (
  'mecanique',
  'electrique',
  'chute_hauteur',
  'chute_objet',
  'chimique',
  'manutention',
  'environnement',
  'incendie',
  'circulation_engins'
);

-- Statut de validation d'une consigne de sécurité (corpus IA, PRD §9).
create type app.statut_consigne as enum (
  'brouillon',
  'en_revue',
  'validee',
  'archivee'
);

-- Saisie d'une donnée de santé : uniquement dans le schéma `medical`.
create type medical.type_dossier as enum (
  'visite_medicale',
  'aptitude',
  'arret_travail',
  'reprise',
  'accident_travail'
);
