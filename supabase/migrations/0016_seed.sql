-- migration 0016 — donnees de test (seed) — <source: section 15.4>
-- Ordre d'execution : referentiel (organisations, sites, zones, equipements,
-- categories) puis comptes de test (auth.users -> trigger handle_new_user ->
-- public.profiles) puis documents et reste du jeu de donnees, car
-- safety_documents.validated_by reference public.profiles(id).
insert into public.organizations (id, name, sector, country)
values ('11111111-1111-4111-8111-111111111111', 'Cimenterie du Sahel', 'cement', 'Burkina Faso')
on conflict do nothing;

insert into public.sites (id, organization_id, name, code, sector, address, is_pilot, is_active)
values ('22222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111',
        'Usine de Soumbo', 'SMB', 'cement', 'Soumbo, Burkina Faso', true, true)
on conflict do nothing;

insert into public.sites (id, organization_id, name, code, sector, address, is_pilot, is_active)
values ('22222222-2222-4222-8222-222222222223',
        '11111111-1111-4111-8111-111111111111',
        'Usine de Koudougou', 'KDG', 'cement', 'Koudougou, Burkina Faso', false, true)
on conflict do nothing;

insert into public.zones (id, site_id, name, type, code)
values
  ('33333333-3333-4333-8333-333333333331', '22222222-2222-4222-8222-222222222222',
   'Crusher hall', 'plant_unit', 'CRUSH'),
  ('33333333-3333-4333-8333-333333333332', '22222222-2222-4222-8222-222222222222',
   'Kiln area', 'plant_unit', 'KILN'),
  ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222',
   'Conveyor gallery', 'plant_unit', 'CONV')
on conflict do nothing;

insert into public.equipments (id, site_id, zone_id, name, asset_code, equipment_type, is_critical)
values
  ('44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333331', 'Primary crusher', 'CRU-01', 'crusher', true),
  ('44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333', 'Gallery conveyor CV-12', 'CV-12', 'conveyor', true)
on conflict do nothing;

insert into public.risk_categories (id, sector, code, label, default_severity, requires_equipment)
values
  ('55555555-5555-4555-8555-555555555551', 'cement', 'machine_guard', 'Machine guard missing or defective', 'high', true),
  ('55555555-5555-4555-8555-555555555552', 'cement', 'conveyor_access', 'Unsafe conveyor access during maintenance', 'critical', true),
  ('55555555-5555-4555-8555-555555555553', 'cement', 'dust_exposure', 'Cement dust exposure', 'medium', false),
  ('55555555-5555-4555-8555-555555555554', 'cement', 'heat_stress', 'Heat stress near the kiln', 'high', false),
  ('55555555-5555-4555-8555-555555555555', 'mining', 'rock_fall', 'Rock fall risk in a mine area', 'critical', false)
on conflict do nothing;

-- ── Comptes de test (identifiables par le préfixe test. + mot de passe haché) ──
-- Mots de passe : TestHse!2026 / TestMed!2026 / TestAdmin!2026 / TestWorker!2026
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-000000000001', 'test.hse@prevensante.test',
   extensions.crypt('TestHse!2026', extensions.gen_salt('bf')), now(),
   '{"full_name":"Herve Kone"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000002', 'test.medecin@prevensante.test',
   extensions.crypt('TestMed!2026', extensions.gen_salt('bf')), now(),
   '{"full_name":"Mariam Ouedraogo"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000003', 'test.admin@prevensante.test',
   extensions.crypt('TestAdmin!2026', extensions.gen_salt('bf')), now(),
   '{"full_name":"Amina Zongo"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000004', 'test.worker@prevensante.test',
   extensions.crypt('TestWorker!2026', extensions.gen_salt('bf')), now(),
   '{"full_name":"Ibrahim Sawadogo"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000005', 'test.worker.b@prevensante.test',
   extensions.crypt('TestWorker!2026', extensions.gen_salt('bf')), now(),
   '{"full_name":"Awa Compaore"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000006', 'test.encadrement@prevensante.test',
   extensions.crypt('TestHse!2026', extensions.gen_salt('bf')), now(),
   '{"full_name":"Salif Zida"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000007', 'test.sanssite@prevensante.test',
   extensions.crypt('TestWorker!2026', extensions.gen_salt('bf')), now(),
   '{"full_name":"Nourou Kaboré"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000008', 'test.superviseur@prevensante.test',
   extensions.crypt('TestHse!2026', extensions.gen_salt('bf')), now(),
   '{"full_name":"Adama Ouattara"}'::jsonb)
on conflict (id) do nothing;

-- Le trigger public.handle_new_user cree deja les profils (role 'worker') ;
-- on affecte le role, le site et l'organization attendus par les tests RLS.
update public.profiles set role = 'hse_officer', organization_id = '11111111-1111-4111-8111-111111111111',
       site_id = '22222222-2222-4222-8222-222222222222', is_medical_authorized = false
 where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'occupational_physician', organization_id = '11111111-1111-4111-8111-111111111111',
       site_id = '22222222-2222-4222-8222-222222222222', is_medical_authorized = true
 where id = 'a0000000-0000-4000-8000-000000000002';
update public.profiles set role = 'admin', organization_id = '11111111-1111-4111-8111-111111111111',
       site_id = '22222222-2222-4222-8222-222222222222', is_medical_authorized = true
 where id = 'a0000000-0000-4000-8000-000000000003';
update public.profiles set role = 'worker', organization_id = '11111111-1111-4111-8111-111111111111',
       site_id = '22222222-2222-4222-8222-222222222222'
 where id = 'a0000000-0000-4000-8000-000000000004';
update public.profiles set role = 'worker', organization_id = '11111111-1111-4111-8111-111111111111',
       site_id = '22222222-2222-4222-8222-222222222223'
 where id = 'a0000000-0000-4000-8000-000000000005';
update public.profiles set role = 'site_director', organization_id = '11111111-1111-4111-8111-111111111111',
       site_id = '22222222-2222-4222-8222-222222222222'
 where id = 'a0000000-0000-4000-8000-000000000006';
update public.profiles set role = 'worker', organization_id = '11111111-1111-4111-8111-111111111111'
 where id = 'a0000000-0000-4000-8000-000000000007';
update public.profiles set role = 'supervisor', organization_id = '11111111-1111-4111-8111-111111111111',
       site_id = '22222222-2222-4222-8222-222222222222'
 where id = 'a0000000-0000-4000-8000-000000000008';

-- ── Jeu de donnees fonctionnel (10 evenements, 8 actions, escalades, propositions IA) ──
-- Reference : section 15.4 de l'analyse ("10 evenements couvrant tous les types et statuts
-- dont 1 accident avec escalade, 1 danger critique, 1 signalement anonyme, 1 evenement avec
-- donnee de sante", "8 actions correctives dont 2 en retard, 1 en to_verify, 1 cloturee avec
-- preuve", "3 escalades", "2 propositions IA").

insert into public.safety_events (id, reference, kind, status, severity, site_id, zone_id, equipment_id, risk_category_id,
                                  occurred_at, activity, description, immediate_measures, reported_consequences,
                                  work_stoppage, injury_reported, photo_paths, reporter_id, is_anonymous,
                                  triaged_by, triaged_at, closed_by, closed_at, closure_note)
values
  -- 1 : danger critique -> declenche automatiquement une escalade (trigger 0013)
  ('aaaaaaaa-0000-4000-8000-000000000001', 'PES-2026-00001', 'danger', 'submitted', 'critical',
   '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333331',
   '44444444-4444-4444-8444-444444444441', '55555555-5555-4555-8555-555555555552',
   now() - interval '2 days', 'Maintenance convoyeur', 'Garde de convoyeur absente sur la bande CV-12',
   'Zone balisee et arret de la ligne', 'Risque de coincement', false, false, '{}',
   'a0000000-0000-4000-8000-000000000004', false, null, null, null, null, null),
  -- 2 : accident avec escalade (le trigger porte le statut a 'escalated')
  ('aaaaaaaa-0000-4000-8000-000000000002', 'PES-2026-00002', 'accident', 'submitted', 'critical',
   '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333331',
   '44444444-4444-4444-8444-444444444441', '55555555-5555-4555-8555-555555555551',
   now() - interval '1 day', 'Concassage', 'Chute de blocs sur l''operateur du concasseur',
   'Secourisme et arret du concasseur', 'Fracture de l''avant-bras', true, true, '{}',
   'a0000000-0000-4000-8000-000000000004', false, null, null, null, null, null),
  -- 3 : incident triage
  ('aaaaaaaa-0000-4000-8000-000000000003', 'PES-2026-00003', 'incident', 'triaged', 'high',
   '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333332', null,
   '55555555-5555-4555-8555-555555555554',
   now() - interval '3 days', 'Cuisson', 'Eclairage deficient au tour du four',
   'Eclairage de secours deploye', 'Fatigue visuelle', false, false, '{}',
   'a0000000-0000-4000-8000-000000000004', false,
   'a0000000-0000-4000-8000-000000000001', now() - interval '2 days', null, null, null),
  -- 4 : incident en cours de traitement
  ('aaaaaaaa-0000-4000-8000-000000000004', 'PES-2026-00004', 'incident', 'in_progress', 'medium',
   '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333332', null,
   '55555555-5555-4555-8555-555555555553',
   now() - interval '5 days', 'Stockage', 'Fuite de poussiere de ciment au silo',
   'Masque et aspirationmobile', 'Irritation respiratoire', false, false, '{}',
   'a0000000-0000-4000-8000-000000000004', false,
   'a0000000-0000-4000-8000-000000000001', now() - interval '4 days', null, null, null),
  -- 5 : signalement anonyme (l'anonymat ne peut etre leve que par un admin)
  ('aaaaaaaa-0000-4000-8000-000000000005', 'PES-2026-00005', 'danger', 'submitted', 'high',
   '22222222-2222-4222-8222-222222222222', null, null, '55555555-5555-4555-8555-555555555551',
   now() - interval '4 days', 'Divers', 'Signalement anonyme : pratiques dangereuses non declarees',
   null, null, false, false, '{}',
   'a0000000-0000-4000-8000-000000000004', true, null, null, null, null, null),
  -- 6 : evenement cloture
  ('aaaaaaaa-0000-4000-8000-000000000006', 'PES-2026-00006', 'incident', 'closed', 'low',
   '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', null,
   '55555555-5555-4555-8555-555555555553',
   now() - interval '20 days', 'Transport', 'Chute de chargeuse sur la voie de circulation',
   'Balisage de la voie', 'Aucune victime', false, false, '{}',
   'a0000000-0000-4000-8000-000000000004', false,
   'a0000000-0000-4000-8000-000000000001', now() - interval '19 days',
   'a0000000-0000-4000-8000-000000000001', now() - interval '10 days', 'Voie balisee et rappel de circulation effectue'),
  -- 7 : evenement rejete
  ('aaaaaaaa-0000-4000-8000-000000000007', 'PES-2026-00007', 'incident', 'rejected', 'low',
   '22222222-2222-4222-8222-222222222222', null, null, null,
   now() - interval '8 days', 'Bureautique', 'Coupure d''electricite sans gravite',
   null, null, false, false, '{}',
   'a0000000-0000-4000-8000-000000000004', false,
   'a0000000-0000-4000-8000-000000000001', now() - interval '7 days',
   null, null, 'Hors perimetre de la plateforme'),
  -- 8 : evenement avec donnee de sante (isolation medicale stricte)
  ('aaaaaaaa-0000-4000-8000-000000000008', 'PES-2026-00008', 'accident', 'triaged', 'high',
   '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333331',
   '44444444-4444-4444-8444-444444444442', '55555555-5555-4555-8555-555555555551',
   now() - interval '6 days', 'Maintenance', 'Entorse de poignet lors d''une intervention',
   'Consultation medicale', 'Inaptitude temporaire', false, true, '{}',
   'a0000000-0000-4000-8000-000000000004', false,
   'a0000000-0000-4000-8000-000000000001', now() - interval '5 days', null, null, null),
  -- 9 : evenement du site B (controle d'acces inter-sites)
  ('aaaaaaaa-0000-4000-8000-000000000009', 'PES-2026-00009', 'incident', 'submitted', 'medium',
   '22222222-2222-4222-8222-222222222223', null, null, null,
   now() - interval '2 days', 'Production', 'Bruit depassant le seuil reglementaire',
   null, null, false, false, '{}',
   'a0000000-0000-4000-8000-000000000005', false, null, null, null, null, null),
  -- 10 : danger du site B (controle d'acces inter-sites)
  ('aaaaaaaa-0000-4000-8000-000000000010', 'PES-2026-00010', 'danger', 'submitted', 'high',
   '22222222-2222-4222-8222-222222222223', null, null, null,
   now() - interval '1 day', 'Logistique', 'Passage de camion sans badge dans l''enclave',
   null, null, false, false, '{}',
   'a0000000-0000-4000-8000-000000000005', false, null, null, null, null, null)
on conflict do nothing;

insert into public.corrective_actions (id, reference, event_id, title, description, owner_id, owner_role,
                                       status, severity, due_at, started_at, submitted_for_verification_at,
                                       closed_at, closed_by, closure_evidence_path, closure_note,
                                       verified_by, verified_at, created_by)
values
  -- A1 : action en retard (echeance depassee)
  ('bbbbbbbb-0000-4000-8000-000000000001', 'ACT-2026-00001',
   'aaaaaaaa-0000-4000-8000-000000000001', 'Reparer la garde du convoyeur CV-12',
   'Remplacement du capteur de presence', 'a0000000-0000-4000-8000-000000000006', 'maintenance_lead',
   'in_progress', 'critical', now() - interval '10 days', now() - interval '9 days',
   null, null, null, null, null, null, null,
   'a0000000-0000-4000-8000-000000000001'),
  -- A2 : action en retard (echeance depassee)
  ('bbbbbbbb-0000-4000-8000-000000000002', 'ACT-2026-00002',
   'aaaaaaaa-0000-4000-8000-000000000003', 'Renover l''eclairage du four',
   'Pose de projecteurs et de luminaires et-IP65', 'a0000000-0000-4000-8000-000000000006', 'maintenance_lead',
   'to_do', 'high', now() - interval '5 days', null,
   null, null, null, null, null, null, null,
   'a0000000-0000-4000-8000-000000000001'),
  -- A3 : action en attente de verification
  ('bbbbbbbb-0000-4000-8000-000000000003', 'ACT-2026-00003',
   'aaaaaaaa-0000-4000-8000-000000000004', 'Confiner le silo de ciment',
   'Pose d''une aspiration mobile a la dechargeuse', 'a0000000-0000-4000-8000-000000000006', 'maintenance_lead',
   'to_verify', 'medium', now() + interval '5 days', now() - interval '4 days',
   now() - interval '1 day', null, null, 'action-evidence/bbbbbbbbb-0000-4000-8000-000000000003/v1/preuve.pdf',
   'Aspiration installee et testee', null, null,
   'a0000000-0000-4000-8000-000000000001'),
  -- A4 : action cloturee avec preuve (verifiee par le HSE, pas par le responsable)
  ('bbbbbbbb-0000-4000-8000-000000000004', 'ACT-2026-00004',
   'aaaaaaaa-0000-4000-8000-000000000006', 'Baliser la voie de circulation',
   'Peinture et panneaux de circulation', 'a0000000-0000-4000-8000-000000000006', 'maintenance_lead',
   'closed', 'low', now() - interval '15 days', now() - interval '14 days',
   now() - interval '12 days', now() - interval '10 days',
   'a0000000-0000-4000-8000-000000000001',
   'action-evidence/bbbbbbbbb-0000-4000-8000-000000000004/v1/preuve.pdf',
   'Voie balisee et photo transmise',
   'a0000000-0000-4000-8000-000000000001', now() - interval '10 days',
   'a0000000-0000-4000-8000-000000000001'),
  -- A5 : action affectee a un salarie du site A
  ('bbbbbbbb-0000-4000-8000-000000000005', 'ACT-2026-00005',
   'aaaaaaaa-0000-4000-8000-000000000008', 'Consigner le convoyeur avant intervention',
   'Consignation et verification de deconsignation', 'a0000000-0000-4000-8000-000000000004', 'action_owner',
   'to_do', 'high', now() + interval '7 days', null,
   null, null, null, null, null, null, null,
   'a0000000-0000-4000-8000-000000000001'),
  -- A6 : action affectee a un salarie du site B
  ('bbbbbbbb-0000-4000-8000-000000000006', 'ACT-2026-00006',
   'aaaaaaaa-0000-4000-8000-000000000009', 'Poser des panneaux de limitation de bruit',
   'Reduction de la vitesse des engins', 'a0000000-0000-4000-8000-000000000005', 'action_owner',
   'to_do', 'medium', now() + interval '10 days', null,
   null, null, null, null, null, null, null,
   'a0000000-0000-4000-8000-000000000001'),
  -- A7 : action en cours
  ('bbbbbbbb-0000-4000-8000-000000000007', 'ACT-2026-00007',
   'aaaaaaaa-0000-4000-8000-000000000002', 'Consigner le concasseur et controler les blocs',
   'Consignation + controle des ecrans de protection', 'a0000000-0000-4000-8000-000000000006', 'maintenance_lead',
   'in_progress', 'critical', now() + interval '2 days', now() - interval '1 day',
   null, null, null, null, null, null, null,
   'a0000000-0000-4000-8000-000000000001'),
  -- A8 : action annulee
  ('bbbbbbbb-0000-4000-8000-000000000008', 'ACT-2026-00008',
   'aaaaaaaa-0000-4000-8000-000000000010', 'Badge supplementaire pour l''enclave',
   'Demande de badges', 'a0000000-0000-4000-8000-000000000005', 'action_owner',
   'cancelled', 'low', now() + interval '20 days', null,
   null, null, null, null, null, null, null,
   'a0000000-0000-4000-8000-000000000001')
on conflict do nothing;

-- 3 escalades au total : 2 creees automatiquement par le trigger 0013
-- (danger critique + accident critique du site A) et 1 escalade manuelle du site B.
insert into public.escalations (id, event_id, level, reason, triggered_by, notified_role, notified_user_id, channel)
values
  ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000009', 'hse_officer',
   'Incident signale au site B', null, 'hse_officer',
   'a0000000-0000-4000-8000-000000000001', 'in_app')
on conflict do nothing;

insert into public.ai_proposals (id, event_id, asked_by, proposal_type, suggested_category_id, suggested_severity,
                                 confidence, rationale, status, reviewed_by, reviewed_at)
values
  ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000001', 'classification', '55555555-5555-4555-8555-555555555554', 'medium',
   0.820, 'Motifs "eclairage" et "four" correspondent aux risques chaleur et eclairage',
   'pending_review', null, null),
  ('dddddddd-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'instruction_lookup', null, null,
   0.910, 'La consigne de consignation des convoyeurs est applicable',
   'accepted', 'a0000000-0000-4000-8000-000000000001', now() - interval '1 day')
on conflict do nothing;

insert into public.medical_records (id, event_id, subject_id, visibility, injury_type, body_part, care_given, fitness_return, recorded_by)
values
  ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000008',
   'a0000000-0000-4000-8000-000000000004', 'physician_only', 'Entorse', 'Poignet',
   'Consultation et immobilisation', 'Reprise apres 15 jours', 'a0000000-0000-4000-8000-000000000002'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000004', 'hse_anonymised', 'Fracture', 'Avant-bras',
   'Consolidation', 'Inaptitude totale', 'a0000000-0000-4000-8000-000000000002')
on conflict do nothing;

insert into public.notifications (id, user_id, event_id, action_id, kind, title, body, severity, data)
values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001', null, 'event_updated',
   'Evenement PES-2026-00001 signale', 'Un danger critique a ete signale sur le site de Soumbo',
   'critical', '{"event_id":"aaaaaaaa-0000-4000-8000-000000000001"}'),
  ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000004',
   'aaaaaaaa-0000-4000-8000-000000000005', null, 'event_updated',
   'Votre signalement anonyme a ete pris en compte', 'Le HSE traite votre signalement',
   'info', '{"event_id":"aaaaaaaa-0000-4000-8000-000000000005"}'),
  ('f0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   null, 'bbbbbbbb-0000-4000-8000-000000000001', 'action_overdue',
   'Action ACT-2026-00001 en retard', 'L''echeance de l''action est depassee', 'warning',
   '{"action_id":"bbbbbbbb-0000-4000-8000-000000000001"}')
on conflict do nothing;

insert into public.email_outbox (id, template, to_email, recipient_name, subject, body, payload, status)
values
  ('f1000000-0000-4000-8000-000000000001', 'event_escalation', 'test.hse@prevensante.test', 'Herve Kone',
   'Escalade : evenement critique', 'Un evenement critique requiert votre attention.',
   '{"event_id":"aaaaaaaa-0000-4000-8000-000000000001"}', 'queued')
on conflict do nothing;

insert into public.sms_outbox (id, to_phone, body, payload, status)
values
  ('f2000000-0000-4000-8000-000000000001', '+22670000001',
   'Escalade : evenement critique a traiter.', '{"event_id":"aaaaaaaa-0000-4000-8000-000000000001"}', 'queued')
on conflict do nothing;

insert into public.safety_documents (id, reference, title, sector, scope_text, status, validated_by, validated_at, review_due_at, file_path)
values
  ('66666666-6666-4666-8666-666666666661', 'SI-CEM-001',
   'Safe maintenance of gallery conveyors', 'cement',
   'Cement plant — conveyor gallery maintenance', 'validated',
   'a0000000-0000-4000-8000-000000000001', now(), current_date + 180,
   '66666666-6666-4666-8666-666666666661/v1/SI-CEM-001.pdf'),
  ('66666666-6666-4666-8666-666666666662', 'SI-CEM-002',
   'Lockout / tagout procedure for crushers', 'cement',
   'Cement plant — crusher hall', 'draft',
   null, null, current_date + 90,
   '66666666-6666-4666-8666-666666666662/v1/SI-CEM-002.pdf')
on conflict do nothing;

insert into public.document_versions (id, document_id, version, change_summary, file_path)
values
  ('77777777-7777-4777-8777-777777777771', '66666666-6666-4666-8666-666666666661', 1,
   'Initial validated version',
   '66666666-6666-4666-8666-666666666661/v1/SI-CEM-001.pdf')
on conflict do nothing;

insert into public.site_worked_hours (site_id, period_start, hours, source)
values ('22222222-2222-4222-8222-222222222222', date_trunc('month', now())::date, 1680.0, 'manual')
on conflict do nothing;

insert into public.app_settings (key, value)
values
  ('app.name', '"PrevEnSante"'::jsonb),
  ('pilot.site_id', '"22222222-2222-4222-8222-222222222222"'::jsonb),
  ('escalation.chain',
   '["hse_officer","site_director","company_officer"]'::jsonb),
  ('assistant.mode', '"rules"'::jsonb),
  ('email.mode', '"mock"'::jsonb),
  ('sms.mode', '"mock"'::jsonb)
on conflict do nothing;
