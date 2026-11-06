-- migration 0019 — colonnes texte non nullables de auth.users — <correctif instance reelle>
--
-- Pourquoi cette migration existe
-- ------------------------------
-- GoTrue declare ces colonnes dans des champs Go de type string (et non
-- *string) : un NULL y est illisible. La migration 0016 les laisse a NULL,
-- et le scan Postgres echoue alors des la recherche de l'utilisateur :
--
--   error finding user: sql: Scan error on column index 3,
--   name "confirmation_token": converting NULL to string is unsupported
--
-- L'API repond alors 500 « Database error querying schema » et aucune
-- connexion n'aboutit, alors que le compte, son mot de passe, son audience
-- et son identite sont corrects (migration 0018).
--
-- GoTrue ecrit lui-meme la chaine vide dans ces colonnes : c'est la valeur
-- neutre attendue, et elle est sans effet sur l'authentification.
--
-- Ce que fait cette migration
-- ---------------------------
-- Aligne sur la chaine vide toutes les colonnes texte que GoTrue lit dans
-- un champ Go non nullable. Seules les lignes concernees sont modifiees ;
-- une ligne deja correcte n'est pas touchee.

update auth.users
set confirmation_token         = coalesce(confirmation_token, ''),
    recovery_token             = coalesce(recovery_token, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    email_change_token_new     = coalesce(email_change_token_new, ''),
    phone_change_token         = coalesce(phone_change_token, ''),
    reauthentication_token     = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change_token_current is null
   or email_change_token_new is null
   or phone_change_token is null
   or reauthentication_token is null;
