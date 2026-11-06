# GUIDE UTILISATEUR ET ADMINISTRATEUR — PrevEnSanté

> **Langue de l'interface : anglais.** Les libellés d'interface cités dans ce guide sont
> reproduits **tels quels** depuis la table de clés i18n (analyse § 11.6) et les écrans
> (§ 11.3). Ils ne sont ni traduits ni inventés.
>
> **Public** : les salariés du site (espace salarié) et les administrateurs (back-office).
> Le reste du document est réservé aux personnes habilitées.

---

# PARTIE A — GUIDE UTILISATEUR (espace salarié)

## A.1 À quoi sert l'application

PrevEnSanté sert à **signaler un danger**, **suivre vos signalements** et **consulter les consignes
de sécurité validées** de votre site.

**Ce que l'application ne fait pas** : elle ne remplace ni les alarmes, ni les arrêts d'urgence,
ni les procédures de consignation, ni le plan d'intervention du site. En cas de danger grave,
l'action humaine immédiate prime sur toute saisie dans l'application.

## A.2 Se connecter

1. Ouvrir l'URL de l'application.
2. Saisir votre adresse e-mail et votre mot de passe.
3. Si votre rôle l'exige (HSE, médecin du travail, direction, administrateur), saisissez le code
   à 6 chiffres de votre application d'authentification (MFA TOTP).
4. En cas de code MFA refusé : utilisez un de vos **codes de secours** (ils sont affichés une
   seule fois à l'enrôlement). Si vous n'avez plus aucun code, contactez votre administrateur.

Règles : mot de passe de **10 caractères minimum**. Le compte peut être désactivé par un
administrateur ; dans ce cas vous recevez un e-mail `Your PrevEnSante account has been
deactivated`.

## A.3 L'accueil

L'écran d'accueil (`/`) propose trois entrées :

| Libellé | Ce qu'il fait |
|---|---|
| `Report a hazard` | Ouvre le formulaire de signalement |
| `My reports` | Ouvre la liste de vos signalements et de vos actions |
| `Safety instructions` | Ouvre le corpus des consignes validées |

## A.4 Signaler un danger

### A.4.1 Démarrer

- `Report a hazard` (accueil) ou la route `/report`.
- Les routes `/report/danger`, `/report/incident`, `/report/accident` ouvrent le formulaire
  **pré-rempli** avec le type choisi.

### A.4.2 Les quatre étapes

| Étape | Ce que vous saisissez |
|---|---|
| **Where** | Site, zone, équipement concerné |
| **What** | Nature du danger (`Danger`, `Incident`, `Accident`), description, activité en cours, horodatage du constat |
| **Evidence** | Photos (optionnel) — compressées avant envoi |
| **Confirmation** | Vérification et envoi |

### A.4.3 Règles de saisie

- La **description** doit comporter **20 caractères minimum**. Si elle est vide, l'écran affiche
  « A description is required. » et l'envoi est refusé — côté serveur également (erreur SQL
  `23514`).
- Un champ obligatoire vide affiche « This field is required. ».
- Une photo peut être retirée via `Remove photo`.
- Vous pouvez signaler **anonymement** avec `Submit anonymously` : votre compte reste tracé pour
  les droits d'accès, mais votre identité n'est pas exposée à l'équipe HSE et **ne peut pas être
  révoquée** par un tiers.

### A.4.4 Actions disponibles

| Libellé | Effet |
|---|---|
| `Submit report` | Envoie le signalement |
| `Add photo` | Ajoute une photo au dossier |
| `Remove photo` | Retire une photo |
| `Submit anonymously` | Bascule en mode anonyme |
| `Save draft` | Conserve le brouillon sur l'appareil |
| `Cancel` | Abandonne la saisie |

### A.4.5 Réseau instable

- Si la connexion échoue, un brouillon **est conservé sur l'appareil** et l'écran affiche
  « Network unavailable. Your draft is saved on this device. » puis, en mode hors-ligne,
  « You are offline. You can review saved data, but new reports need a connection. ».
- **Aucune soumission hors-ligne n'est garantie** (hors périmètre PRD). Le brouillon est
  re-synchronisé à la reconnexion : en cas de conflit, il est conservé et vous êtes invité à le
  vérifier.
- Les données déjà consultées restent lisibles hors-ligne (lecture seule).

### A.4.6 Après l'envoi

L'écran `/report/success` affiche :

- votre **référence** au format `PES-2026-xxxxx`, en police monospace et copiable ;
- le type et le statut de votre signalement ;
- le rappel d'urgence ;
- deux actions : `Track this report` et `Report another hazard`.

Si vous avez signalé anonymement, le message est différent : « Your report is recorded. Your
identity is hidden from the safety team. ».

**Aucune donnée médicale n'est demandée à cette étape** : les éléments d'aptitude sont saisis par
le médecin du travail dans l'espace `/medical`.

## A.5 Danger grave ou immédiat — le bandeau d'urgence

Si, dans le formulaire, vous indiquez un `Danger` de sévérité **immediate**, l'écran de
confirmation affiche un bandeau d'urgence **non fermable** :

> « This application does not replace your site emergency procedures. Move to a safe place and
> follow the site emergency plan. »

**Que faire dans cet ordre**

1. **Vous mettre en sécurité immédiatement**, sans attendre la fin de la saisie.
2. **Appliquer les procédures d'urgence de votre site** (alarmes, arrêts d'urgence, consignation,
   plan d'intervention).
3. **Signaler** dans l'application dès que possible, pour tracer l'événement.
4. **Prévenir** votre encadrant par le canal habituel de l'entreprise. L'application ne se
   substitue pas à cette alerte.
5. Après l'envoi, l'événement est **escaladé automatiquement** au niveau 1 (HSE du site), et le
   bandeau d'urgence reste affiché.

En mode `immediate`, **aucune proposition de l'assistant n'est proposée avant le traitement de
l'alerte** : l'IA ne doit jamais retarder une intervention.

## A.6 Suivre vos signalements

`My reports` (route `/my-reports`) liste vos signalements et vos actions. Chaque dossier
(`/my-reports/:id`) affiche l'historique et les actions correctives liées.

Statuts possibles d'un événement (badges) :

| Badge | Signification |
|---|---|
| `Submitted` | Signalement enregistré, en attente de triage |
| `Under review` | En cours d'examen par l'équipe HSE |
| `Triaged` | Qualifié (catégorie, sévérité, zone, équipement) |
| `Escalated` | Escaladé (danger grave) |
| `Closed` | Clos |

Sévérités : `Low`, `Medium`, `High`, `Critical`.

Vous recevez une notification dans l'application (`Notifications`, avec pastille non lue) à
chaque étape : dépôt, triage, affectation d'une action, clôture. Un e-mail vous informe également
lorsqu'un dossier est rejeté (motif obligatoire) ou clôturé.

Si un événement est rejeté, le motif est indiqué dans le message « About your safety event … ».
Vous pouvez ajouter un commentaire ou signaler à nouveau : **un nouveau signalement vaut toujours
mieux qu'un risque silencieux**.

## A.7 Consulter les consignes de sécurité

`Safety instructions` (route `/instructions`) ouvre le corpus des **consignes validées**
uniquement. Recherche par secteur et par équipement.

- Un document en `draft` n'est **jamais** visible dans cet espace.
- Chaque consigne affiche sa référence, son titre, sa version, son secteur, le badge `Validated` et
  le lien vers le PDF.
- Les **consignes ne sont pas traduites** : elles restent dans la langue de leur document source,
  avec leurs références citées telles quelles. Utilisez-les comme le document d'origine.
- Si votre recherche ne renvoie rien : « No validated instruction is available for this search. » —
  signalez-le à votre administrateur : le corpus est peut-être incomplet.

## A.8 Notifications et paramètres

- `Notifications` : centre de notifications, pastille non lue, compteur dans l'en-tête mobile.
- Les notifications `critical` déclenchent aussi un bandeau dans l'application si l'onglet est
  ouvert.
- `Settings` : profil, site, préférences.
- `Settings > Security` : activation du MFA, codes de secours.

## A.9 Qui contacter

| Sujet | Contact |
|---|---|
| Problème d'accès au compte, MFA, compte désactivé | Votre administrateur |
| Suivi d'un signalement | L'équipe HSE de votre site |
| Contenu d'une consigne | Le référent documentaire |
| Danger en cours | **Procédure d'urgence du site** d'abord, puis l'application |

---

# PARTIE B — GUIDE ADMINISTRATEUR (back-office)

> Le back-office est accessible aux comptes de rôle `admin` uniquement ; une garde de route
> protège `/admin/*`.

## B.1 Se connecter et sécuriser son compte

- Compte `admin` : **MFA TOTP obligatoire**.
- `/settings/security` : activer le MFA, **sauvegarder les 10 codes de secours** (affichés une
  seule fois).
- Mot de passe de 10 caractères minimum.

## B.2 Créer un compte, lui attribuer un rôle et un site

Route `/admin/users` → action `Invite user`.

1. Saisir l'e-mail du futur utilisateur.
2. Choisir le **rôle** (`Change role`). Rôles disponibles (8) :
   `worker`, `supervisor`, `hse_officer`, `maintenance_lead`, `action_owner`,
   `occupational_physician`, `site_director`, `admin`.
   > **Statut d'activation (A2)** : sur le site pilote, seuls `worker`, `hse_officer` et `admin`
   > sont pleinement opérationnels. Les autres rôles existent en base et sont **activables par
   > l'administrateur**.
3. Définir le **périmètre de site** via `Set site scope`. Un compte sans site **ne voit rien** :
   c'est le comportement attendu, pas une panne.
4. Si le compte doit accéder aux données de santé : `Toggle medical authorization`
   (`is_medical_authorized`). Ne l'accordez que si le rôle le justifie.
5. Valider → la fonction `invite-user` crée le compte et envoie l'e-mail d'invitation
   (gabarit `account_invitation`).
6. L'utilisateur clique sur le lien, crée son mot de passe, puis active le MFA depuis
   `Settings > Security` si son rôle l'exige.

Autres actions de `/admin/users` : `Resend invitation` (renvoi), `Deactivate` (envoie l'e-mail
`Your PrevEnSante account has been deactivated`), `Reactivate`.

> Les actions des rôles, de site et de consigne validée sont **tracées dans `audit_log`** avec
> l'avant/après, et consultables dans `/admin/audit`.

## B.3 Gérer les sites, zones et équipements

Route `/admin/sites`.

| Action | Effet |
|---|---|
| `Add site` | Crée un site (organisation, secteur, code) |
| `Add zone` | Ajoute une zone à un site |
| `Add equipment` | Ajoute un équipement (type, caractère critique) |
| `Edit` | Modifie un site, une zone ou un équipement |
| `Set as pilot site` | Définit le site pilote (`sites.is_pilot = true`) |
| `Activate/Deactivate` | Bascule l'état du site |

**Règles**

- **Un seul site pilote** (arbitrage A1). Les autres sites, zones et secteurs sont créables **sans
  migration** : le multi-sites est prévu par conception.
- Le secteur du site pilote conditionne les `risk_categories` disponibles et la couverture du
  corpus de consignes.
- Les équipements `is_critical = true` sont ceux qui remontent dans les priorités de triage.

Route `/admin/categories` — par secteur :

| Action | Effet |
|---|---|
| `Add category` | Crée une catégorie de risque |
| `Edit` | Modifie le libellé, la sévérité par défaut, le caractère « équipement requis » |
| `Deactivate` | Désactive une catégorie |

## B.4 Valider une version de consigne

Route `/admin/documents`.

1. `Upload version` : déposer le PDF dans le bucket privé `safety-documents`.
2. Vérifier que le document est **rattaché à un secteur ou à un site** : « un corpus sans périmètre
   n'est pas consultable par l'IA ».
3. Faire **valider par un référent** (compte habilité) → `Validate version`.
   - Le document passe à `status = 'validated'`, `validated_by` et `validated_at` sont renseignés.
   - La version courante est incrémentée.
   - `Set review date` : fixer `review_due_at` (30 jours avant échéance, une notification part vers
     le HSE).
4. `Archive document` : archiver une consigne retirée.

**Effet de la validation** : le document devient consultable par l'assistant et par les salariés.
Tant que la validation n'est pas faite, l'assistant ne peut pas le citer.

> Un document `draft` n'est visible que par les personnes habilitées. Le passage `draft` →
> `validated` est tracé dans `audit_log`.

## B.5 Consulter le journal d'audit

Route `/admin/audit` — journal filtrable par acteur, action, entité et date.

- Actions disponibles : `Filter`, `Export CSV`.
- À vérifier en priorité : changement de rôle, changement de périmètre de site, validation d'une
  consigne, désactivation d'un compte, export de rapport.
- Un export de rapport est journalisé dans `audit_log` (garde-fou R9 : l'export est limité au
  périmètre et généré en `service_role`).

## B.6 Consulter l'outbox (emails et SMS)

Route `/admin/outbox` — liste des emails et SMS envoyés : destinataire, gabarit, sujet, statut,
erreur.

| Action | Effet |
|---|---|
| `Resend` | Rejoue un envoi en échec (idempotent) |
| `Mark as failed` | Marque manuellement une ligne en échec |
| `Open payload` | Affiche le contenu envoyé (variables, gabarit) |

**À vérifier chaque jour** : toute ligne en `failed` doit être traitée (voir `docs/RUNBOOK.md`,
incident I1).

En mode `mock` (par défaut tant que le SMTP n'est pas configuré), **aucun e-mail réel n'est
envoyé** : les lignes restent visibles ici. C'est le moyen de vérifier le contenu des gabarits
sans risque d'envoi.

Rappel : le SMS est un canal de secours réservé à l'équipe HSE pour les escalades critiques et les
actions critiques en retard. Il n'est jamais adressé au salarié.

## B.7 Vérifier une action corrective

Route `/hse/actions/:id/verify` — accessible aux rôles `hse_officer` et `site_director`.

1. Ouvrir l'action : la preuve de clôture est jointe par le responsable via
   `Attach closure proof` — `Submit for verification` est bloqué sans preuve, et le serveur
   rejette également l'appel.
2. Vérifier que la preuve est **exploitable** (photo lisible, document pertinent).
3. `Verify and close` — **uniquement si vous n'êtes pas l'actionnaire** de l'action. La règle
   `verified_by <> owner_id` est appliquée en base, pas seulement dans l'interface ; si vous
   essayez, l'application affiche « An action cannot be verified by its own owner. ».
4. `Reject closure proof` : un **motif est obligatoire**. L'action repasse en `In progress` et
   `reopen_count` est incrémenté ; le responsable est notifié.
5. `Reopen action` : rouvrir une action clôturée à tort.

> **Séparation des responsabilités** : l'administrateur **n'a pas de raccourci** pour valider une
> action corrective à la place du HSE. Il ne le peut que s'il est lui-même habilité `hse_officer`
> sur le site ; sinon, il faut passer par un compte HSE (arbitrage A3).

## B.8 Réglages globaux

Route `/admin/settings` → action `Save`.

| Réglage | Contenu |
|---|---|
| Nom de l'instance | `PrevEnSante` |
| Site pilote | `sites.is_pilot = true` |
| Mode email / SMS / IA | `mock` / `live`, `off` / `rules` / `live` |
| Chaîne d'escalade | `hse_officer` → `site_director` → `company_officer` |
| Seuils de notification | regroupement, anti-spam, délais |

## B.9 Tâches périodiques de l'administrateur

| Tâche | Périodicité |
|---|---|
| Consulter `/admin/outbox` et traiter les lignes `failed` | Quotidienne |
| Vérifier les escalades ouvertes dans `/hse/escalations` | Quotidienne |
| Contrôler les invitations en attente et les comptes désactivés à réactiver | Hebdomadaire |
| Relire le journal d'audit | Hebdomadaire |
| Vérifier les consignes dont `review_due_at` approche à moins de 30 jours | Mensuelle |
| Recenser les accès Terrain (`Set site scope`) et les habilitations médicales | Mensuelle |
| Contrôler que les heures travaillées du site sont saisies (sinon le taux d'accidents n'est pas calculable) | Mensuelle |

## B.10 Erreurs courantes côté administrateur

| Message | Cause | Action |
|---|---|---|
| « You are not allowed to access this site. » | Le compte n'est pas rattaché au site concerné | `Set site scope` |
| Un compte connecté ne voit aucune donnée | Aucun site affecté, ou rôle non activé | `Set site scope`, vérifier le rôle |
| « An action cannot be verified by its own owner. » | Tentative de vérifier sa propre action | Un autre vérificateur habilité doit intervenir |
| « A description is required. » | Champ obligatoire vide | Le demandeur corrige |
| « The assistant is unavailable. The event was not modified. » | `AI_MODE=off` ou fournisseur IA injoignable | Repasser en `rules` ou corriger le fournisseur ; l'événement n'a pas été modifié |
| « No validated instruction is available for this search. » | Aucun document `validated` pour ce secteur | Faire valider une consigne dans `/admin/documents` |
| Un taux d'accidents absent | Heures travaillées non saisies | Saisir `site_worked_hours` ; sinon « Accident rate: not available — worked hours not provided. » |

---

## Annexe — Récapitulatif des libellés d'interface cités

| Contexte | Libellé (anglais, verbatim) |
|---|---|
| Navigation | `Report a hazard`, `My reports`, `Safety instructions`, `Notifications`, `Settings` |
| Types | `Danger`, `Incident`, `Accident` |
| Statuts d'événement | `Submitted`, `Under review`, `Triaged`, `Escalated`, `Closed` |
| Sévérités | `Low`, `Medium`, `High`, `Critical` |
| Statuts d'action | `To do`, `In progress`, `To verify`, `Closed`, `Cancelled` |
| Actions formulaire | `Submit report`, `Add photo`, `Remove photo`, `Submit anonymously`, `Save draft`, `Cancel` |
| Actions back-office | `Invite user`, `Change role`, `Set site scope`, `Toggle medical authorization`, `Deactivate`, `Reactivate`, `Resend invitation`, `Add site`, `Add zone`, `Add equipment`, `Edit`, `Set as pilot site`, `Activate/Deactivate`, `Add category`, `Deactivate`, `Upload version`, `Validate version`, `Archive document`, `Set review date`, `Filter`, `Export CSV`, `Resend`, `Mark as failed`, `Open payload`, `Save` |
| Actions actions correctives | `Start work`, `Attach closure proof`, `Submit for verification`, `Verify and close`, `Reject closure proof`, `Reopen action` |
| Actions assistant | `Ask the assistant`, `Accept the proposal`, `Reject the proposal` |
| Erreurs | `This field is required.`, `A description is required.`, `Closure proof is required before verification.`, `An action cannot be verified by its own owner.`, `You are offline. New actions need a connection.`, `The assistant is unavailable. The event was not modified.`, `You are not allowed to access this site.` |
| Bandeau d'urgence | `This application does not replace your site emergency procedures. Move to a safe place and follow the site emergency plan.` |
| États vides | `No safety event matches these filters.`, `No corrective action to show.`, `No validated instruction is available for this search.`, `No new notifications.` |
| Confirmation anonyme | `Your report is recorded. Your identity is hidden from the safety team.` |
| Réseau | `Network unavailable. Your draft is saved on this device.`, `You are offline. You can review saved data, but new reports need a connection.` |
| Taux d'accidents | `Accident rate: not available — worked hours not provided.` |
