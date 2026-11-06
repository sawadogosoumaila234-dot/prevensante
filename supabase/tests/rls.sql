-- supabase/tests/rls.sql — tests de non-regression RLS (section 15.3 de l'analyse)
--
-- Format : SQL transactionnel, chaque test est un bloc BEGIN/COMMIT et leve une
-- exception (RAISE EXCEPTION) en cas d'echec. Le fichier est autonome :
--   * psql     : psql -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
--   * Supabase : supabase test db  (le fichier est aussi lu par tools/test-fonctionnel.mjs)
--   * local    : node tools/test-fonctionnel.mjs
--
-- Les tests s'executent sur le schema public (organizations, sites, profiles,
-- safety_events, corrective_actions, escalations, medical_records, ai_proposals,
-- notifications, email_outbox, sms_outbox, safety_documents) et s'appuient sur les
-- comptes de test du seed 0016. Aucun privilege superieur n'est requis :
-- chaque test bascule sur le role `authenticated` ou `anon` et pose le claim JWT
-- via request.jwt.claims, exactement comme le fait PostgREST.

-- ── Outils de test (schema temporaire de la session) ──────────────────────────
create temporary table rls_results (
  id        serial primary key,
  test_name text not null,
  ok        boolean not null,
  detail    text
);

-- Enregistre le resultat d'un test (execute en SECURITY DEFINER : le role de
-- test n'a pas besoin de droits sur la table temporaire).
create or replace function pg_temp.rls_record(p_name text, p_ok boolean, p_detail text default null)
returns void language plpgsql security definer set search_path = pg_temp as $$
begin
  insert into pg_temp.rls_results (test_name, ok, detail)
  values (p_name, coalesce(p_ok, false), p_detail);
end $$;

-- Leve une exception si la condition n'est pas satisfaite.
create or replace function pg_temp.rls_assert(p_name text, p_cond boolean, p_detail text default null)
returns void language plpgsql security definer set search_path = pg_temp as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'ECHEC RLS : % (%)', p_name, coalesce(p_detail, 'condition non satisfaite');
  end if;
end $$;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
  begin
    select count(*) into v_n from public.safety_events where site_id <> '22222222-2222-4222-8222-222222222222';
    perform pg_temp.rls_assert('T01 salarie du site A ne voit aucun evenement du site B',
                                v_n = 0, format('%s evenement(s) du site B visibles', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T01 salarie du site A ne voit aucun evenement du site B', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000007","role":"authenticated"}';
  begin
    select count(*) into v_n from public.safety_events;
    perform pg_temp.rls_assert('T02 salarie sans site ne voit aucun evenement',
                                v_n = 0, format('%s evenement(s) visibles', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T02 salarie sans site ne voit aucun evenement', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
  begin
    update public.safety_events set description = 'modification interdite'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001';
    get diagnostics v_n = row_count;
    perform pg_temp.rls_assert('T03 salarie ne peut pas modifier le signalement d''un autre',
                                v_n = 0, format('%s ligne(s) modifiee(s)', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T03 salarie ne peut pas modifier le signalement d''un autre', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000008","role":"authenticated"}';
  begin
    begin
      insert into public.medical_records (event_id, subject_id, visibility, recorded_by)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'physician_only', 'a0000000-0000-4000-8000-000000000008');
      raise exception 'audit attendu en echec : insertion medical_records acceptee';
    exception when others then
      if sqlerrm not like '%Medical records can only be recorded by an authorized medical profile%'
         and sqlerrm not like '%row-level security%' then
        raise;
      end if;
    end;
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T04 superviseur ne peut pas inserer dans medical_records', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  begin
    select count(*) into v_n from public.medical_records;
    perform pg_temp.rls_assert('T05 hse_officer non habilite ne peut pas lire medical_records',
                                v_n = 0, format('%s dossier(s) medical(s) visible(s)', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T05 hse_officer non habilite ne peut pas lire medical_records', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
  begin
    select count(*) into v_n from public.medical_records;
    perform pg_temp.rls_assert('T06 medecin habilite lit les dossiers medicaux du site',
                                v_n = 2, format('%s dossier(s) medical(s) visible(s) (attendu 2)', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T06 medecin habilite lit les dossiers medicaux du site', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
  begin
    begin
      update public.corrective_actions
         set status = 'closed', closed_at = now(), closed_by = 'a0000000-0000-4000-8000-000000000004',
             closure_evidence_path = 'preuve/x.pdf', closure_note = 'auto-verification',
             verified_by = 'a0000000-0000-4000-8000-000000000004', verified_at = now()
       where id = 'bbbbbbbb-0000-4000-8000-000000000005';
      raise exception 'audit attendu en echec : auto-verification acceptee';
    exception when others then
      if sqlerrm not like '%cannot be verified by its own owner%'
         and sqlerrm not like '%row-level security%' then
        raise;
      end if;
    end;
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T07 actionnaire ne peut pas cloturer sa propre action', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
  begin
    begin
      perform public.verify_and_close_action('bbbbbbbb-0000-4000-8000-000000000005', 'tentative non autorisee');
      raise exception 'audit attendu en echec : cloture par un role non-HSE acceptee';
    exception when others then
      if sqlerrm not like '%not allowed to verify this action%'
         and sqlerrm not like '%row-level security%' then
        raise;
      end if;
    end;
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T08 role non-HSE ne peut pas cloturer une action corrective', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
  begin
    update public.corrective_actions set description = 'modification interdite'
     where id = 'bbbbbbbb-0000-4000-8000-000000000001';
    get diagnostics v_n = row_count;
    perform pg_temp.rls_assert('T09 actionnaire ne peut pas modifier une action qui ne lui est pas affectee',
                                v_n = 0, format('%s ligne(s) modifiee(s)', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T09 actionnaire ne peut pas modifier une action qui ne lui est pas affectee', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000006","role":"authenticated"}';
  begin
    update public.corrective_actions set description = 'modification interdite'
     where id = 'bbbbbbbb-0000-4000-8000-000000000005';
    get diagnostics v_n = row_count;
    perform pg_temp.rls_assert('T10 site_director ne peut pas modifier une action corrective qu''il ne possede pas',
                                v_n = 0, format('%s ligne(s) modifiee(s)', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T10 site_director ne peut pas modifier une action corrective qu''il ne possede pas', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
  begin
    select count(*) into v_n from public.safety_documents where status = 'draft';
    perform pg_temp.rls_assert('T11 worker ne peut pas lire un document au statut draft',
                                v_n = 0, format('%s document(s) draft visible(s)', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T11 worker ne peut pas lire un document au statut draft', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role anon;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000007","role":"anon"}';
  begin
    select (select count(*) from public.notifications)
         + (select count(*) from public.email_outbox)
         + (select count(*) from public.sms_outbox) into v_n;
    perform pg_temp.rls_assert('T12 anon ne peut pas lire notifications, email_outbox ni sms_outbox',
                                v_n = 0, format('%s ligne(s) visible(s)', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T12 anon ne peut pas lire notifications, email_outbox ni sms_outbox', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
  begin
    update public.ai_proposals
       set status = 'accepted', reviewed_by = 'a0000000-0000-4000-8000-000000000004', reviewed_at = now()
     where id = 'dddddddd-0000-4000-8000-000000000001';
    get diagnostics v_n = row_count;
    perform pg_temp.rls_assert('T13 worker ne peut pas accepter une proposition IA',
                                v_n = 0, format('%s proposition(s) mise(s) a jour', v_n));
    select count(*) into v_n from public.ai_proposals
     where id = 'dddddddd-0000-4000-8000-000000000001' and status = 'pending_review' and applied_at is null;
    perform pg_temp.rls_assert('T13 worker ne peut pas accepter une proposition IA',
                                v_n = 1, 'la proposition n''a pas du changer d''etat');
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T13 worker ne peut pas accepter une proposition IA', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  begin
    select count(*) into v_n from public.ai_proposals where applied_at is not null;
    perform pg_temp.rls_assert('T14 proposition IA jamais appliquee automatiquement',
                                v_n = 0, format('%s proposition(s) appliquee(s) sans validation humaine', v_n));
    begin
      perform public.apply_ai_proposal('dddddddd-0000-4000-8000-000000000001', 'tentative automatique');
      raise exception 'audit attendu en echec : proposition en attente appliquee';
    exception when others then
      if sqlerrm not like '%must be reviewed and accepted%'
         and sqlerrm not like '%row-level security%' then
        raise;
      end if;
    end;
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T14 proposition IA jamais appliquee automatiquement', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  begin
    select status into v_detail from public.safety_events where id = 'aaaaaaaa-0000-4000-8000-000000000001';
    perform pg_temp.rls_assert('T15 danger critique : escalade automatique et statut escalated',
                                v_detail = 'escalated', format('statut = %s', v_detail));
    select count(*) into v_n from public.escalations where event_id = 'aaaaaaaa-0000-4000-8000-000000000001';
    perform pg_temp.rls_assert('T15 danger critique : escalade automatique et statut escalated',
                                v_n >= 1, format('%s escalade(s) pour l''evenement critique', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T15 danger critique : escalade automatique et statut escalated', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
  begin
    begin
      insert into public.safety_event_logs (event_id, action) values ('aaaaaaaa-0000-4000-8000-000000000001', 'updated');
      raise exception 'audit attendu en echec : insertion dans safety_event_logs acceptee';
    exception when others then
      if sqlerrm not like '%row-level security%' then
        raise;
      end if;
    end;
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T16 worker ne peut pas inserer dans safety_event_logs', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
  begin
    perform public.verify_and_close_action('bbbbbbbb-0000-4000-8000-000000000003', 'verification sur site');
    select count(*) into v_n from public.corrective_actions
     where id = 'bbbbbbbb-0000-4000-8000-000000000003' and status = 'closed' and verified_by = 'a0000000-0000-4000-8000-000000000001';
    perform pg_temp.rls_assert('T17 hse_officer peut cloturer une action en attente de verification',
                                v_n = 1, format('%s action(s) close(s) et verifiee(s) par le HSE', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T17 hse_officer peut cloturer une action en attente de verification', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
  begin
    select count(*) into v_n from public.safety_events where site_id = '22222222-2222-4222-8222-222222222222';
    perform pg_temp.rls_assert('T18 salarie du site B ne voit aucun evenement du site A',
                                v_n = 0, format('%s evenement(s) du site A visibles', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T18 salarie du site B ne voit aucun evenement du site A', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
  begin
    select count(*) into v_n from public.safety_events;
    perform pg_temp.rls_assert('T19 admin voit tous les evenements',
                                v_n = 10, format('%s evenement(s) visible(s) (attendu 10)', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T19 admin voit tous les evenements', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
  begin
    select count(*) into v_n
      from public.corrective_actions c
      join public.safety_events e on e.id = c.event_id
     where e.site_id = '22222222-2222-4222-8222-222222222223';
    perform pg_temp.rls_assert('T20 salarie du site A ne voit aucune action corrective du site B',
                                v_n = 0, format('%s action(s) du site B visible(s)', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T20 salarie du site A ne voit aucune action corrective du site B', v_ok, v_detail);
end
$test$;
commit;

begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
  begin
    select count(*) into v_n from public.notifications where user_id <> 'a0000000-0000-4000-8000-000000000004';
    perform pg_temp.rls_assert('T21 salarie ne voit que ses propres notifications',
                                v_n = 0, format('%s notification(s) tierce(s) visible(s)', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T21 salarie ne voit que ses propres notifications', v_ok, v_detail);
end
$test$;
commit;

-- T22 : l'administrateur ne peut pas cloturer une action corrective (arbitrage A3)
--
-- L'application ecrit directement dans `corrective_actions` : c'est donc le trigger
-- `guard_action_transition` (migration 0021) qui doit refuser la cloture, et pas
-- seulement la fonction `verify_and_close_action`.
begin;
do $test$
declare
  v_ok    boolean := true;
  v_detail text   := null;
  v_n     integer := 0;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
  begin
    -- L'administrateur prepare l'action comme s'il etait le verificateur.
    update public.corrective_actions
       set status = 'to_verify',
           submitted_for_verification_at = now(),
           closure_evidence_path = 'action-evidence/bbbbbbbb-0000-4000-8000-000000000002/v1/preuve.pdf',
           closure_note = 'tentative de verification par l administrateur'
     where id = 'bbbbbbbb-0000-4000-8000-000000000002';
    get diagnostics v_n = row_count;
    perform pg_temp.rls_assert('T22 preparation de l action par l administrateur',
                                v_n = 1, format('%s action(s) preparee(s)', v_n));
    begin
      update public.corrective_actions
         set status = 'closed',
             closed_at = now(),
             closed_by = 'a0000000-0000-4000-8000-000000000003',
             closure_evidence_path = 'action-evidence/bbbbbbbb-0000-4000-8000-000000000002/v1/preuve.pdf',
             closure_note = 'tentative de verification par l administrateur',
             verified_by = 'a0000000-0000-4000-8000-000000000003',
             verified_at = now()
       where id = 'bbbbbbbb-0000-4000-8000-000000000002';
      raise exception 'audit attendu en echec : cloture par l administrateur acceptee';
    exception when others then
      if sqlerrm not like '%authorised verifier%' then
        raise;
      end if;
    end;
    select count(*) into v_n from public.corrective_actions
     where id = 'bbbbbbbb-0000-4000-8000-000000000002'
       and status = 'closed';
    perform pg_temp.rls_assert('T22 administrateur ne peut pas cloturer une action corrective',
                                v_n = 0, format('%s action(s) close(s) par l administrateur', v_n));
  exception when others then
    v_ok := false;
    v_detail := sqlerrm;
  end;
  perform pg_temp.rls_record('T22 administrateur ne peut pas cloturer une action corrective', v_ok, v_detail);
end
$test$;
commit;

-- ── Bilan ────────────────────────────────────────────────────────────────────
begin;
do $final$
declare
  v_total integer;
  v_ok    integer;
  v_ko    integer;
  v_row   record;
begin
  select count(*),
         count(*) filter (where ok),
         count(*) filter (where not ok)
    into v_total, v_ok, v_ko
    from pg_temp.rls_results;

  raise notice 'RLS : % test(s) — % reussi(s), % echec(s)', v_total, v_ok, v_ko;

  if v_ko > 0 then
    for v_row in select test_name, detail from pg_temp.rls_results where not ok order by id loop
      raise notice 'ECHEC : % — %', v_row.test_name, v_row.detail;
    end loop;
    raise exception 'RLS : % test(s) en echec sur %', v_ko, v_total;
  end if;
end
$final$;
commit;
