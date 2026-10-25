-- =============================================================================
-- PrevEnSanté — 0003 : fonctions utilitaires, triggers, RLS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitaires de rôle
-- -----------------------------------------------------------------------------

-- Rôle de l'utilisateur courant (hors rôle `service_role`).
create or replace function app.role_courant()
returns app.role_acteur
language sql stable security definer set search_path = public, app as $$
  select role_acteur from app.profiles where id = auth.uid();
$$;

-- L'utilisateur courant est-il administrateur ?
create or replace function app.est_administrateur()
returns boolean
language sql stable security definer set search_path = public, app as $$
  select coalesce(app.role_courant() = 'administrateur', false);
$$;

-- L'utilisateur courant est-il responsable HSE (qualification, actions) ?
create or replace function app.est_hse()
returns boolean
language sql stable security definer set search_path = public, app as $$
  select coalesce(app.role_courant() in ('responsable_hse', 'administrateur'), false);
$$;

-- L'utilisateur courant est-il médecin du travail ?
create or replace function app.est_medecin()
returns boolean
language sql stable security definer set search_path = public, app as $$
  select coalesce(app.role_courant() = 'medecin_du_travail', false);
$$;

-- Liste des sites visibles par l'utilisateur courant.
-- Administrateur : tous les sites. Les autres : les sites du profile_sites.
create or replace function app.sites_visibles()
returns setof uuid
language sql stable security definer set search_path = public, app as $$
  select case
    when app.est_administrateur() then (select id from app.sites)
    else (select site_id from app.profile_sites where profile_id = auth.uid())
  end;
$$;

-- Un site donné est-il dans le périmètre de l'utilisateur ?
create or replace function app.acces_site(p_site_id uuid)
returns boolean
language sql stable security definer set search_path = public, app as $$
  select p_site_id in (select app.sites_visibles());
$$;

-- -----------------------------------------------------------------------------
-- Triggers : mise à jour automatique et journalisation
-- -----------------------------------------------------------------------------

create or replace function app.touch_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger signalements_touch before update on app.signalements
  for each row execute function app.touch_updated_at();
create trigger actions_touch before update on app.actions_correctives
  for each row execute function app.touch_updated_at();
create trigger consignes_touch before update on app.consignes
  for each row execute function app.touch_updated_at();
create trigger profiles_touch before update on app.profiles
  for each row execute function app.touch_updated_at();

-- Journal des modifications (traçabilité, PRD F3).
create or replace function app.journaliser()
returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if tg_op = 'INSERT' then
    insert into app.journal_modifications (table_name, enregistrement_id, operation, nouveau, auteur_id)
    values (tg_table_name, new.id, 'insert', to_jsonb(new), auth.uid());
  elsif tg_op = 'UPDATE' then
    insert into app.journal_modifications (table_name, enregistrement_id, operation, ancien, nouveau, auteur_id)
    values (tg_table_name, new.id, 'update', to_jsonb(old), to_jsonb(new), auth.uid());
  elsif tg_op = 'DELETE' then
    insert into app.journal_modifications (table_name, enregistrement_id, operation, ancien, auteur_id)
    values (tg_table_name, old.id, 'delete', to_jsonb(old), auth.uid());
  end if;
  return null;
end;
$$;

create trigger signalements_journal after insert or update or delete on app.signalements
  for each row execute function app.journaliser();
create trigger actions_journal after insert or update or delete on app.actions_correctives
  for each row execute function app.journaliser();
create trigger profiles_journal after insert or update or delete on app.profiles
  for each row execute function app.journaliser();
create trigger consignes_journal after insert or update or delete on app.consignes
  for each row execute function app.journaliser();

-- -----------------------------------------------------------------------------
-- RLS : activation sur toutes les tables applicatives
-- -----------------------------------------------------------------------------

alter table app.secteurs              enable row level security;
alter table app.sites                 enable row level security;
alter table app.zones                 enable row level security;
alter table app.profiles              enable row level security;
alter table app.profile_sites         enable row level security;
alter table app.signalements          enable row level security;
alter table app.actions_correctives   enable row level security;
alter table app.pieces_jointes        enable row level security;
alter table app.consignes             enable row level security;
alter table app.journal_modifications enable row level security;
alter table app.notifications         enable row level security;
alter table app.rapports              enable row level security;
alter table app.liaisons_accident_dossier enable row level security;
alter table medical.dossiers          enable row level security;

-- -----------------------------------------------------------------------------
-- Politiques : référentiels (lecture large, écriture administrateur)
-- -----------------------------------------------------------------------------

create policy secteurs_lire on app.secteurs
  for select using (true);
create policy secteurs_ecrire on app.secteurs
  for all using (app.est_administrateur()) with check (app.est_administrateur());

create policy sites_lire on app.sites
  for select using (app.acces_site(id));
create policy sites_ecrire on app.sites
  for all using (app.est_administrateur()) with check (app.est_administrateur());

create policy zones_lire on app.zones
  for select using (site_id in (select app.sites_visibles()));
create policy zones_ecrire on app.zones
  for all using (app.est_administrateur()) with check (app.est_administrateur());

-- -----------------------------------------------------------------------------
-- Politiques : profils
-- -----------------------------------------------------------------------------

-- Chaque utilisateur lit son propre profil ; les HSE et administrateurs lisent
-- les profils des personnes de leur périmètre.
create policy profils_lire on app.profiles
  for select using (
    id = auth.uid()
    or app.est_administrateur()
    or (app.est_hse() and exists (
      select 1 from app.profile_sites ps
      join app.profile_sites myps on myps.site_id = ps.site_id
      where ps.profile_id = app.profiles.id and myps.profile_id = auth.uid()
    ))
  );

create policy profils_modifier on app.profiles
  for update using (id = auth.uid() or app.est_administrateur())
  with check (id = auth.uid() or app.est_administrateur());

-- L'administrateur gère les comptes et les rôles.
create policy profils_administrer on app.profiles
  for all using (app.est_administrateur()) with check (app.est_administrateur());

create policy profile_sites_lire on app.profile_sites
  for select using (site_id in (select app.sites_visibles()) or profile_id = auth.uid());
create policy profile_sites_ecrire on app.profile_sites
  for all using (app.est_administrateur()) with check (app.est_administrateur());

-- -----------------------------------------------------------------------------
-- Politiques : signalements
-- -----------------------------------------------------------------------------

-- Lecture : périmètre de sites, plus les signalements de son auteur.
create policy signalements_lire on app.signalements
  for select using (
    site_id in (select app.sites_visibles())
    or auteur_id = auth.uid()
  );

-- Création : n'importe quel utilisateur authentifié du site concerné.
create policy signalements_creer on app.signalements
  for insert with check (
    site_id in (select app.sites_visibles())
    and (auteur_id = auth.uid() or auteur_id is null)
  );

-- Modification : l'auteur peut compléter son signalement tant qu'il n'est pas
-- clos ; le HSE qualifie et clôture.
create policy signalements_modifier on app.signalements
  for update using (
    (auteur_id = auth.uid() and statut in ('nouveau', 'en_qualification'))
    or app.est_hse()
  ) with check (
    site_id in (select app.sites_visibles())
  );

create policy signalements_supprimer on app.signalements
  for delete using (app.est_administrateur());

-- -----------------------------------------------------------------------------
-- Politiques : actions correctives
-- -----------------------------------------------------------------------------

create policy actions_lire on app.actions_correctives
  for select using (site_id in (select app.sites_visibles()));

-- Création et modification : HSE, ou le responsable désigné de l'action.
create policy actions_creer on app.actions_correctives
  for insert with check (
    site_id in (select app.sites_visibles())
    and (app.est_hse() or responsable_id = auth.uid())
  );

create policy actions_modifier on app.actions_correctives
  for update using (
    app.est_hse() or responsable_id = auth.uid()
  ) with check (site_id in (select app.sites_visibles()));

-- La clôture exige une personne compétente (HSE) : on ne peut pas se contenter
-- d'une politique, car les politiques UPDATE de Postgres sont combinées par OU —
-- `actions_modifier` autoriserait sinon le responsable à clore sa propre action.
-- Le contrôle est donc fait par trigger, seul mécanisme qui refuse réellement.
create or replace function app.verifier_cloture_action()
returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if new.statut = 'cloturee'
     and (tg_op = 'INSERT' or old.statut is distinct from 'cloturee')
     and not app.est_hse() then
    raise exception 'Clôture réservée à une personne compétente (responsable HSE).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger actions_cloture_avant before insert or update on app.actions_correctives
  for each row execute function app.verifier_cloture_action();

create policy actions_supprimer on app.actions_correctives
  for delete using (app.est_administrateur());

-- Un utilisateur ne peut pas s'attribuer un rôle : le rôle ne change que par
-- l'administrateur (PRD §5, §8 « gestion des autorisations »).
create or replace function app.proteger_role_profil()
returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if new.role_acteur is distinct from old.role_acteur
     and not app.est_administrateur() then
    raise exception 'Modification du rôle réservée à l''administrateur.'
      using errcode = '42501';
  end if;
  if new.id <> auth.uid() and not app.est_administrateur() then
    raise exception 'Modification d''un autre profil réservée à l''administrateur.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_role_avant before update on app.profiles
  for each row execute function app.proteger_role_profil();

-- -----------------------------------------------------------------------------
-- Politiques : pièces jointes
-- -----------------------------------------------------------------------------

create policy pieces_lire on app.pieces_jointes
  for select using (
    exists (select 1 from app.signalements s
            where s.id = signalement_id
              and (s.site_id in (select app.sites_visibles()) or s.auteur_id = auth.uid()))
  );
create policy pieces_ecrire on app.pieces_jointes
  for insert with check (
    exists (select 1 from app.signalements s
            where s.id = signalement_id and s.auteur_id = auth.uid())
  );
create policy pieces_supprimer on app.pieces_jointes
  for delete using (app.est_hse());

-- -----------------------------------------------------------------------------
-- Politiques : corpus de consignes (IA)
-- -----------------------------------------------------------------------------

-- Seules les consignes validées sont lisibles par les non-administrateurs.
create policy consignes_lire on app.consignes
  for select using (statut = 'validee' or app.est_administrateur() or app.est_hse());

create policy consignes_ecrire on app.consignes
  for all using (app.est_administrateur()) with check (app.est_administrateur());

-- -----------------------------------------------------------------------------
-- Politiques : journal, notifications, rapports
-- -----------------------------------------------------------------------------

create policy journal_lire on app.journal_modifications
  for select using (app.est_hse());

create policy notifications_lire on app.notifications
  for select using (destinataire_id = auth.uid());
create policy notifications_maj on app.notifications
  for update using (destinataire_id = auth.uid()) with check (destinataire_id = auth.uid());
create policy notifications_ecrire on app.notifications
  for insert with check (app.est_hse() or app.est_administrateur());

create policy rapports_lire on app.rapports
  for select using (site_id is null or site_id in (select app.sites_visibles()));
create policy rapports_ecrire on app.rapports
  for insert with check (auteur_id = auth.uid() and app.est_hse());
create policy rapports_supprimer on app.rapports
  for delete using (app.est_administrateur());

create policy liaisons_lire on app.liaisons_accident_dossier
  for select using (
    app.est_medecin()
    or exists (select 1 from app.signalements s
               where s.id = signalement_id and s.site_id in (select app.sites_visibles()))
  );
create policy liaisons_ecrire on app.liaisons_accident_dossier
  for all using (app.est_medecin()) with check (app.est_medecin());

-- -----------------------------------------------------------------------------
-- RLS `medical` : le schéma le plus restrictif du projet
-- -----------------------------------------------------------------------------

-- Par défaut, aucun accès direct au client web (RLS activée, aucune policy).
-- Seul le médecin du travail du site concerné accède à son périmètre.
create policy dossiers_medecin on medical.dossiers
  for select using (
    app.est_medecin()
    and site_id in (select app.sites_visibles())
  );

create policy dossiers_ecriture_medecin on medical.dossiers
  for insert with check (
    app.est_medecin()
    and site_id in (select app.sites_visibles())
  );

create policy dossiers_modification_medecin on medical.dossiers
  for update using (
    app.est_medecin()
    and site_id in (select app.sites_visibles())
  ) with check (app.est_medecin());

-- -----------------------------------------------------------------------------
-- Recherche vectorielle des consignes (PRD §9.2)
-- -----------------------------------------------------------------------------

create or replace function app.rechercher_consignes(
  p_embedding vector(768),
  p_secteur_id uuid default null,
  p_categorie app.categorie_risque default null,
  p_limit int default 5
)
returns table (id uuid, code text, titre text, contenu text, distance float)
language sql stable security definer set search_path = public, app as $$
  select c.id, c.code, c.titre, c.contenu, c.embedding <=> p_embedding as distance
  from app.consignes c
  where c.statut = 'validee'
    and (p_secteur_id is null or c.secteur_id is null or c.secteur_id = p_secteur_id)
    and (p_categorie is null or c.categorie is null or c.categorie = p_categorie)
  order by c.embedding <=> p_embedding
  limit least(greatest(p_limit, 1), 20);
$$;

-- -----------------------------------------------------------------------------
-- KPI du tableau de bord (PRD §11) — calculés en base, jamais côté navigateur
-- -----------------------------------------------------------------------------

create or replace function app.kpi_site(p_site_id uuid, p_depuis timestamptz default null)
returns table (
  total bigint,
  dangers bigint,
  incidents bigint,
  accidents bigint,
  en_cours bigint,
  clotures bigint,
  actions_total bigint,
  actions_retard bigint,
  actions_cloturees bigint,
  delai_prise_en_charge_jours numeric
)
language sql stable security definer set search_path = public, app as $$
  select
    count(*),
    count(*) filter (where s.type_evenement = 'danger'),
    count(*) filter (where s.type_evenement = 'incident'),
    count(*) filter (where s.type_evenement = 'accident'),
    count(*) filter (where s.statut not in ('clos', 'rejete')),
    count(*) filter (where s.statut = 'clos'),
    (select count(*) from app.actions_correctives a where a.site_id = p_site_id),
    (select count(*) from app.actions_correctives a
      where a.site_id = p_site_id and a.statut <> 'cloturee'
        and a.echeance_at is not null and a.echeance_at < current_date),
    (select count(*) from app.actions_correctives a
      where a.site_id = p_site_id and a.statut = 'cloturee'),
    (select round(avg(extract(epoch from (s.updated_at - s.declare_at)) / 86400)::numeric, 2)
     from app.signalements s
     where s.site_id = p_site_id and s.statut = 'clos'
       and (p_depuis is null or s.declare_at >= p_depuis))
  from app.signalements s
  where s.site_id = p_site_id
    and (p_depuis is null or s.declare_at >= p_depuis);
$$;
