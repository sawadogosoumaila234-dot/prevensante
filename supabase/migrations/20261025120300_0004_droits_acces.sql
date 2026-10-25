-- =============================================================================
-- PrevEnSanté — 0004 : droits d'accès (GRANT) aux rôles Supabase
-- =============================================================================
-- Supabase n'accorde par défaut des droits que sur le schéma `public`.
-- Les schémas `app` et `medical` doivent donc être explicitement accordés.
-- Sans ce fichier, les politiques RLS existent mais le rôle `authenticated`
-- reçoit « permission denied for schema app » : aucune donnée n'est visible.
--
-- Principe : le rôle `authenticated` reçoit les droits CRUD sur `app.*`,
-- et RLS filtre ligne par ligne. Le schéma `medical` n'est PAS accordé
-- directement : il passe par les fonctions `security definer`, qui
-- contrôlent elles-mêmes le rôle (médecin du travail).

-- -----------------------------------------------------------------------------
-- Usage des schémas
-- -----------------------------------------------------------------------------

grant usage on schema app to authenticated, anon, service_role;

-- `medical` : le schéma est accordé à `authenticated` pour que les politiques
-- RLS puissent faire leur travail (filtrer ligne par ligne). C'est la RLS,
-- et non l'absence de droits, qui protège les données de santé : un rôle
-- `hse` ou `travailleur` connecté au schéma voit zéro ligne.
grant usage on schema medical to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Droits sur les tables de `app`
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on all tables in schema app to authenticated;
grant all on all tables in schema app to service_role;
grant usage, select on all sequences in schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Droits sur les tables de `medical`
-- -----------------------------------------------------------------------------
-- Le médecin du travail accède au dossier via `medical.dossiers` ; les
-- politiques RLS du schéma `medical` restreignent la lecture à son rôle et
-- à son périmètre de sites. Aucune donnée de santé n'est lisible par un
-- autre rôle, même s'il possède le droit de lecture sur la table.

grant select, insert, update on medical.dossiers to authenticated;
grant all on all tables in schema medical to service_role;
grant usage, select on all sequences in schema medical to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Droits sur les fonctions
-- -----------------------------------------------------------------------------
-- Les fonctions de rôle (`est_hse`, `est_medecin`, `role_courant`,
-- `sites_visibles`) doivent être appelables depuis les politiques RLS.
-- `security definer` + `search_path` restreint : elles s'exécutent avec
-- les droits du propriétaire, mais ne divulguent rien d'autre que ce que
-- leurs arguments permettent.

grant execute on all functions in schema app to authenticated, anon, service_role;
grant execute on all functions in schema medical to authenticated, anon, service_role;

-- -----------------------------------------------------------------------------
-- Droits par défaut pour les objets futurs
-- -----------------------------------------------------------------------------
-- Sans ces clauses, une table ajoutée plus tard par une nouvelle migration
-- serait invisible pour l'application.

alter default privileges in schema app
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema app
  grant all on tables to service_role;
alter default privileges in schema app
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema app
  grant execute on functions to authenticated, anon, service_role;

alter default privileges in schema medical
  grant all on tables to service_role;
alter default privileges in schema medical
  grant execute on functions to authenticated, anon, service_role;

-- -----------------------------------------------------------------------------
-- Le rôle `anon` (visiteur non authentifié) ne doit rien voir du tout :
-- on lui retire explicitement les droits accordés par défaut par Supabase.
-- -----------------------------------------------------------------------------

revoke all on all tables in schema app from anon;
revoke all on all sequences in schema app from anon;
revoke all on schema medical from anon;
