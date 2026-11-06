-- migration 0017 — alignement des sequences de reference sur le jeu de donnees
--
-- Le seed 0016 insere des references explicites (PES-2026-00001 … PES-2026-00010,
-- ACT-2026-00001 …) mais n'avance pas les sequences qui les generent.
-- Sans cet alignement, le premier signalement cree apres l'installation
-- genere une reference deja utilisee et echoue :
--   duplicate key value violates unique constraint "safety_events_reference_key"
--
-- Les sequences sont donc positionnees sur la plus haute reference existante :
-- le prochain nextval() rend le numero suivant, et la reference
-- « PES-AAAA-NNNNN » / « ACT-AAAA-NNNNN » reste unique.
--
-- La partie numerique d'une reference est le suffixe : on l'extrait par
-- expression reguliere pour ne pas dependre de l'annee.

select setval(
  'public.event_ref_seq',
  coalesce(
    (select max(substring(reference from '[0-9]+$')::bigint) from public.safety_events),
    0
  ),
  true
);

select setval(
  'public.action_ref_seq',
  coalesce(
    (select max(substring(reference from '[0-9]+$')::bigint) from public.corrective_actions),
    0
  ),
  true
);
