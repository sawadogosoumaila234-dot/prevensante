-- migration 0020 — colonnes texte restantes de auth.users — <correctif instance reelle>
--
-- Pourquoi cette migration existe
-- ------------------------------
-- GoTrue declare email_change dans un champ Go de type string : un NULL y
-- est illisible, et le scan Postgres echoue des la recherche de l'utilisateur :
--
--   error finding user: sql: Scan error on column index 8,
--   name "email_change": converting NULL to string is unsupported
--
-- d'ou un 500 « Database error querying schema » sur toute tentative de
-- connexion, alors que le compte, son mot de passe, son audience et son
-- identite sont corrects (migrations 0018 et 0019).
--
-- Ce que fait cette migration
-- ---------------------------
-- Aligne sur leur valeur neutre toutes les colonnes texte et booleennes de
-- auth.users que GoTrue lit dans un champ Go non nullable. Les colonnes
-- horodatees (invited_at, confirmation_sent_at, last_sign_in_at,
-- recovery_sent_at, email_change_sent_at, phone_confirmed_at,
-- reauthentication_sent_at, banned_until, deleted_at) restent NULL :
-- GoTrue les lit dans des pointeurs, et NULL y est la valeur correcte.

update auth.users
set confirmation_token         = coalesce(confirmation_token, ''),
    recovery_token             = coalesce(recovery_token, ''),
    email_change               = coalesce(email_change, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    email_change_token_new     = coalesce(email_change_token_new, ''),
    phone_change               = coalesce(phone_change, ''),
    phone_change_token         = coalesce(phone_change_token, ''),
    reauthentication_token     = coalesce(reauthentication_token, ''),
    is_super_admin             = coalesce(is_super_admin, false)
where confirmation_token is null
   or recovery_token is null
   or email_change is null
   or email_change_token_current is null
   or email_change_token_new is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null
   or is_super_admin is null;
