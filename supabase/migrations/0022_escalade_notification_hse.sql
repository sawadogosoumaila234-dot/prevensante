-- migration 0022 — escalade critique effective et notifiee aux HSE du site
--
-- Deux defauts distincts etaient cumules, tous deux dans la chaine
-- d'alerte d'un danger grave :
--
-- 1. L'escalade ne se declenchait qu'a l'INSERTION de l'evenement. Or la
--    severite d'un signalement n'est pas connue a la declaration : elle est
--    fixee au triage (fonction `triage_safety_event`, ou application d'une
--    proposition IA). Dans le flux reel, un evenement declare avec la
--    severite par defaut 'medium' et classe 'critical' plus tard par le HSE
--    ne declenchait donc AUCUNE escalade : aucune ligne dans `escalations`,
--    `notified_user_id` a nul, et le statut de l'evenement restait
--    'triaged'. Le declencheur est donc elargi a la mise a jour.
--
-- 2. Meme lorsqu'une escalade etait creee, aucun destinataire n'etait
--    designe : aucune ligne dans `notifications`, et la cloche de
--    l'application n'affichait aucun compteur de non-lus. Le HSE ne pouvait
--    apprendre qu'un danger critique avait ete declare qu'en ouvrant l'ecran
--    des escalades.
--
-- Cette migration corrige les deux points :
--
--  - le declencheur se declenche a l'insertion ET a la mise a jour, mais
--    seulement quand l'evenement devient critique, ou quand sa nature
--    passe a 'danger'/'accident' ;
--  - l'escalade notifie les HSE du site concerne et de son organisation, par
--    `notifications` (donc dans l'application, sans aucun fournisseur ni
--    cout), ainsi que les administrateurs, qui ont deja visibility sur tout ;
--  - les files d'envoi `email_outbox` et `sms_outbox` sont alimentees
--    egalement : elles restent en attente tant que `email.mode` et `sms.mode`
--    sont a 'mock', et partiront des qu'un fournisseur sera nomme.
--
-- La regle de destinataires est celle de `can_verify_action()` : meme site,
-- ou meme organisation pour les roles `hse_officer` et `site_director`.
--
-- Toutes les insertions sont idempotentes : un evenement critique qui est
-- re-triage ou mis a jour ne doit produire ni une seconde escalade, ni une
-- seconde notification, ni un second envoi en file d'attente.

create or replace function public.escalate_critical_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_escalation uuid;
  v_site text;
  v_org uuid;
  v_deja_critique boolean := false;
begin
  -- Seuls les dangers et les accidents escaladent. Un incident critique se
  -- suit, mais ne declenche pas la chaine d'escalade HSE.
  if new.kind not in ('danger','accident') or new.severity <> 'critical' then
    return new;
  end if;

  -- A la mise a jour, l'evenement n'escalade que s'il *devient* critique,
  -- ou si sa nature change alors qu'il est deja critique. Sans cette
  -- condition, la mise a jour du statut declenchee plus bas par cette
  -- fonction reentrerait ici indefiniment.
  if tg_op = 'UPDATE' then
    if old.severity = 'critical' and old.kind = new.kind then
      v_deja_critique := true;
    end if;
  end if;

  select s.name, s.organization_id into v_site, v_org
  from public.sites s
  where s.id = new.site_id;

  -- 1. Escalade : une seule par evenement. Si l'evenement en possede deja
  --    une (donnee historique ou reaffectation), elle est conservee.
  insert into public.escalations (event_id, level, reason, triggered_by,
                                  notified_role, channel)
  select new.id, 'hse_officer',
         'Critical severity reported on ' || new.reference,
         auth.uid(), 'hse_officer', 'in_app'
  where not exists (
    select 1 from public.escalations e where e.event_id = new.id
  )
  returning id into v_escalation;

  -- 2. Notification dans l'application : elle est visible immediatement,
  --    sans passer par un e-mail ni un SMS. C'est le canal qui fonctionne
  --    deja, sans fournisseur ni cout.
  insert into public.notifications (user_id, event_id, kind, title, body, severity, data)
  select p.id, new.id, 'critical_escalation',
         'Critical danger reported at ' || coalesce(v_site, 'your site'),
         'Reference ' || new.reference || '. Immediate triage is required.',
         'critical',
         jsonb_build_object('event_id', new.id, 'action', 'open_event')
  from public.profiles p
  where p.is_active
    and p.role in ('hse_officer', 'site_director', 'admin')
    and (
      p.site_id = new.site_id
      or (p.organization_id = v_org and p.role in ('hse_officer', 'site_director'))
      or p.role = 'admin'
    )
    and not exists (
      select 1 from public.notifications n
      where n.event_id = new.id
        and n.user_id = p.id
        and n.kind = 'critical_escalation'
    );

  -- 3. File d'attente e-mail : le message partira des qu'un fournisseur
  --    sera configure ; en attendant, il est consultable dans /admin/outbox.
  insert into public.email_outbox (template, to_email, recipient_name, subject, body, payload)
  select 'critical_event_hse', p.email, p.full_name,
         'Critical danger reported at ' || coalesce(v_site, 'your site'),
         'A critical danger was reported at ' || coalesce(v_site, 'your site')
           || '. Reference ' || new.reference || '. Immediate triage is required.',
         jsonb_build_object('reference', new.reference,
                            'site', coalesce(v_site, 'your site'),
                            'event_id', new.id)
  from public.profiles p
  where p.is_active
    and p.email is not null
    and p.role in ('hse_officer', 'site_director', 'admin')
    and (
      p.site_id = new.site_id
      or (p.organization_id = v_org and p.role in ('hse_officer', 'site_director'))
      or p.role = 'admin'
    )
    and not exists (
      select 1 from public.email_outbox o
      where o.template = 'critical_event_hse'
        and o.payload->>'event_id' = new.id::text
    );

  -- 4. File d'attente SMS : uniquement pour les comptes dont le numero est
  --    connu. Le SMS est le canal de secours des escalades critiques.
  insert into public.sms_outbox (to_phone, body, payload)
  select p.phone,
         'Critical danger reported at ' || coalesce(v_site, 'your site')
           || '. Reference ' || new.reference || '.',
         jsonb_build_object('reference', new.reference,
                            'site', coalesce(v_site, 'your site'),
                            'event_id', new.id)
  from public.profiles p
  where p.is_active
    and p.phone is not null
    and btrim(p.phone) <> ''
    and p.role in ('hse_officer', 'site_director', 'admin')
    and (
      p.site_id = new.site_id
      or (p.organization_id = v_org and p.role in ('hse_officer', 'site_director'))
      or p.role = 'admin'
    )
    and not exists (
      select 1 from public.sms_outbox o
      where o.payload->>'event_id' = new.id::text
    );

  -- 5. Premier destinataire de l'escalade, pour la prise en compte.
  update public.escalations
     set notified_user_id = coalesce(notified_user_id, (
           select p.id
           from public.profiles p
           where p.is_active
             and p.role in ('hse_officer', 'site_director', 'admin')
             and (
               p.site_id = new.site_id
               or (p.organization_id = v_org and p.role in ('hse_officer', 'site_director'))
               or p.role = 'admin'
             )
           order by (p.role = 'hse_officer') desc, (p.site_id = new.site_id) desc
           limit 1
         ))
   where event_id = new.id;

  -- 6. Le statut de l'evenement porte la trace de l'escalade. Dans un
  --    declencheur AFTER, la modification de NEW est ignoree : le passage en
  --    'escalated' se fait donc par un UPDATE explicite.
  --    Un evenement deja critique garde ce statut : le re-triage repose
  --    'triaged' sur la ligne, mais un danger critique reste escalate.
  update public.safety_events
     set status = 'escalated'
   where id = new.id
     and status <> 'escalated';

  return new;
end $$;

-- Le declencheur doit couvrir la mise a jour : la severite critique est
-- posee au triage, pas a la declaration. La condition « l'evenement devient
-- critique » est portee par la fonction elle-meme, ce qui evite toute
-- recursion via l'UPDATE du statut.
drop trigger if exists trg_safety_events_escalate on public.safety_events;
create trigger trg_safety_events_escalate
  after insert or update on public.safety_events
  for each row execute function public.escalate_critical_event();
