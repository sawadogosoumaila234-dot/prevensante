-- migration 0018 — identites Auth des comptes de recette — <correctif instance reelle>
--
-- Pourquoi cette migration existe
-- ------------------------------
-- La migration 0016 insere les comptes de recette directement dans
-- auth.users, ce qui suffit en local (PGlite n'a pas de moteur Auth) mais
-- pas sur une instance Supabase reelle : GoTrue ne les trouve pas et
-- l'API renvoie « Invalid login credentials ».
--
-- La recherche de GoTrue est (internal/models/user.go) :
--
--   FindUserByEmailAndAudience :
--     instance_id = <uuid.Nil> and LOWER(email) = ? and aud = ?
--     and is_sso_user = false
--
-- or 0016 laisse instance_id, aud et role a NULL : la comparaison avec
-- l'uuid Nil et avec l'audience 'authenticated' echoue, et aucun compte
-- n'est trouve.
--
-- GoTrue cree en outre une ligne dans auth.identities a chaque
-- inscription ; une insertion SQL directe ne la cree pas. L'identite est
-- ce qui porte le fournisseur (provider 'email') et le `sub` utilise par
-- la generation du jeton.
--
-- Ce que fait cette migration
-- ---------------------------
-- 1. complete les colonnes que GoTrue attend (instance_id a l'uuid Nil,
--    aud et role a 'authenticated', app_metadata et user_metadata) ;
-- 2. cree l'identite 'email' manquante, avec provider_id = sub (l'uuid
--    de l'utilisateur), conformement a internal/models/identity.go.
--
-- Elle est corrective et idempotente : elle ne porte que sur les comptes
-- de recette deja presents dans auth.users, et ne cree une identite que
-- si elle n'existe pas deja. Les lignes public.profiles, creees par le
-- trigger handle_new_user lors de 0016, ne sont pas modifiees : le
-- trigger est declenche sur INSERT, pas sur UPDATE.

-- 1. completes les colonnes attendues par GoTrue.
update auth.users u
set aud              = 'authenticated',
    role             = 'authenticated',
    instance_id      = '00000000-0000-0000-0000-000000000000',
    raw_app_meta_data  = coalesce(u.raw_app_meta_data, '{}'::jsonb)
                          || '{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
                          || '{"email_verified":true}'::jsonb,
    created_at       = coalesce(u.created_at, now()),
    updated_at       = coalesce(u.updated_at, now())
where u.email like 'test.%@prevensante.test'
  and u.email_confirmed_at is not null;

-- 2. cree l'identite 'email' manquante (provider_id = sub).
--    La colonne auth.identities.email est une colonne generee
--    (lower(identity_data ->> 'email')) : elle se deduit de identity_data et
--    ne doit pas etre fournie.
insert into auth.identities
  (id, user_id, provider_id, identity_data, provider,
   last_sign_in_at, created_at, updated_at)
select gen_random_uuid(),
       u.id,
       u.id::text,
       jsonb_build_object('sub', u.id::text,
                          'email', u.email,
                          'email_verified', true,
                          'phone', '',
                          'phone_verified', false,
                          'is_anonymous', false,
                          'role', 'authenticated'),
       'email',
       now(), now(), now()
from auth.users u
where u.email like 'test.%@prevensante.test'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email');
