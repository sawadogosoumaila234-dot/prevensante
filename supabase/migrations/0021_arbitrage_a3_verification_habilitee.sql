-- migration 0021 — arbitrage A3 : seul un verificateur habilite peut cloturer
--
-- Decision du commanditaire (02/11/2026), fiche `docs/ARBITRAGES.md` A3, option (a) :
-- « l'administrateur ne verifie pas » — la position ecrite dans le PV de recette.
--
-- Constat : les deux sources de verite divergeaient.
--
--   * `public.can_verify_action` (migration 0010) autorisait `public.is_admin()` :
--     l'administrateur pouvait cloturer une action corrective.
--   * l'interface (`web/src/lib/rls/permissions.ts`, `canVerifyAction`) le refuse :
--     `if (profile.role === 'admin') return false`.
--
-- Et surtout : l'application ne passe pas par `verify_and_close_action`, elle ecrit
-- directement dans `corrective_actions` (`web/src/lib/mutations.ts`, fonction
-- `verifyAndCloseAction`). Le seul point de passage reel etait donc le trigger
-- `guard_action_transition` (migration 0013), qui verifiait la presence des preuves et
-- le fait que le responsable ne valide pas sa propre action — mais **pas**
-- l'habilitation du verificateur. Un administrateur pouvait donc cloturer une action
-- en ecrivant directement les colonnes de preuve.
--
-- Cette migration ferme les deux chemins :
--
--   1. `can_verify_action` ne reconnait plus l'administrateur ;
--   2. `guard_action_transition` refuse toute cloture dont l'acteur n'est pas un
--      verificateur habilite, et exige que la personne verifiee soit la personne
--      authentifiee : le journal d'audit ne peut plus designer un tiers.
--
-- Verificateurs retenus : `hse_officer` et `site_director`, sur le site de l'action ou
-- dans la meme organisation. C'est la regle deja documentee dans la fiche d'arbitrage
-- (« role hse_officer ou site_director, sur le site ou dans la meme organisation »), et
-- la regle que l'interface applique deja.
--
-- L'ordre des verifications est preserve : le controle « le responsable ne peut pas
-- verifier sa propre action » reste avant le controle d'habilitation, pour que le
-- message d'erreur du test T07 ne change pas.

create or replace function public.can_verify_action(p_action uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.corrective_actions a
    join public.safety_events e on e.id = a.event_id
    where a.id = p_action
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_active
          and p.role in ('hse_officer','site_director')
          and (p.site_id = e.site_id or p.organization_id = (
                select organization_id from public.sites where id = e.site_id))
      )
  );
$$;

create or replace function public.guard_action_transition()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status = 'to_verify' and new.submitted_for_verification_at is null then
    raise exception 'Moving an action to "to_verify" requires a submission date'
      using errcode = '23514';
  end if;
  if new.status = 'closed' and (
        new.closed_at is null or new.closed_by is null
        or new.closure_evidence_path is null or new.closure_note is null
        or new.verified_by is null or new.verified_at is null) then
    raise exception 'Closing an action requires closure proof and a verification record'
      using errcode = '23514';
  end if;
  if new.status = 'closed' and new.verified_by is not null and new.verified_by = new.owner_id then
    raise exception 'An action cannot be verified by its own owner'
      using errcode = '23514';
  end if;
  if new.status = 'closed' and old.status <> 'to_verify' then
    raise exception 'An action must pass through the "to_verify" status before closing'
      using errcode = '23514';
  end if;
  -- A3 : l'acteur de la cloture doit etre un verificateur habilite. L'administrateur
  -- n'en est pas un : il ne peut pas valider une action a la place du HSE.
  if new.status = 'closed' and not public.can_verify_action(new.id) then
    raise exception 'Only an authorised verifier can close an action'
      using errcode = '42501';
  end if;
  -- A3 : la personne verifiee est la personne authentifiee. Le journal d'audit ne
  -- peut pas designer un tiers.
  if new.status = 'closed' and new.verified_by <> auth.uid() then
    raise exception 'The verifier of an action must be the authenticated user'
      using errcode = '42501';
  end if;
  return new;
end $$;
