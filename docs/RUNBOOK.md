# RUNBOOK D'EXPLOITATION — PrevEnSanté

> Document opérationnel court. Chaque incident suit la même trame : **symptôme → vérification →
> action → escalade**.
> Références : `ANALYSE-GLOBALE-PREVSANTE.md` (sections 10, 14, 16.5, 18.1) et
> `docs/DEPLOIEMENT.md`.

## 0. Rappel permanent

- PrevEnSanté **ne remplace ni les alarmes, ni les arrêts d'urgence, ni les procédures de
  consignation, ni le plan d'intervention du site** (PRD § 5, hors périmètre).
- Une alerte `critical` dans l'application **exige une action humaine immédiate** ; elle ne se
  traite pas par e-mail.
- Le SMS est un **canal de secours réservé à l'équipe HSE**, pour les escalades critiques
  uniquement. Il n'est jamais proposé au salarié.
- L'IA est **consultative** : elle ne modifie jamais un événement sans validation humaine.

---

## 1. Surveillance quotidienne

| # | Quoi | Où | Fréquence | Action si anomalie |
|---|---|---|---|---|
| 1 | `email_outbox.status = 'failed'` | `/admin/outbox` | Chaque jour | Voir incident I1 |
| 2 | `sms_outbox.status = 'failed'` | `/admin/outbox` | Chaque jour | Voir incident I1 |
| 3 | Files `queued` qui ne se vident pas | `/admin/outbox` | Chaque jour | Voir incident I1 (dispatcher bloqué) |
| 4 | Escalades ouvertes non acquittées | `/hse/escalations` | Chaque jour | Voir incident I4 |
| 5 | Actions correctives en retard | `/hse/actions` | Chaque jour | `Open overdue actions` dans `/hse` |
| 6 | Santé des Edge Functions | Supabase Dashboard > Edge Functions > Logs | Chaque jour | Voir incident I1 |
| 7 | Tâches `pg_cron` actives | `select jobid, schedule, active from cron.job;` | Chaque jour | Voir incident I1 |
| 8 | Journal d'audit (mutations de rôle, de site, de consigne) | `/admin/audit` | Chaque semaine | Investiguer toute mutation non attendue |

**Écarts de volume à surveiller** : une forte baisse des signalements un jour de production
signale souvent une coupure d'accès ou un problème d'authentification, pas une amélioration.

---

## 2. Incidents

### I1 — Notifications en échec (`email_outbox` / `sms_outbox` en `failed`)

**Symptôme** : des destinataires ne reçoivent rien ; l'outbox affiche des lignes `failed`.

**Vérification**

- [ ] `/admin/outbox` → filtrer sur le statut `failed` → `Open payload` pour lire le gabarit et
      l'erreur.
- [ ] `EMAIL_MODE` / `SMS_MODE` : la valeur attendue est-elle `live` ? Un retour à `mock` explique
      des lignes qui ne partent pas.
- [ ] Identifiants SMTP : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
      toujours présents côté Edge Functions ? Un secret expiré est fréquent.
- [ ] Quotité SMTP : l'erreur mentionne-t-elle un quota dépassé ?
- [ ] Le dispatcher tourne-t-il ? Vérifier que la tâche `pg_cron` de `dispatch-outbox` est active
      et que la dernière invocation n'a pas échoué.
- [ ] Une escalade `critical` est-elle concernée ? Si oui, traiter en priorité (voir I4).

**Action**

1. Corriger la cause (mode, secret, quota, planification).
2. Relancer les envois échoués depuis `/admin/outbox` via `Resend` (idempotent : un envoi déjà
   effectué n'est pas rejoué).
3. Si la cause n'est pas identifiée en 30 minutes, basculer temporairement les canaux non critiques
   en `mock` pour ne pas accumuler d'échecs, et escalader.
4. Consigner l'incident : date, nombre de lignes, cause, action, horodatage UTC.

**Escalade** : après 1 h sans résolution → responsable d'exploitation (§ 5).

---

### I2 — Action corrective bloquée en `to_verify`

**Symptôme** : une action reste en statut `To verify` ; le responsable ou le HSE ne peut pas la
clôturer.

**Rappel des règles** (arbitrage A3) : le passage par `to_verify` est **obligatoire** avant
`closed` ; la vérification doit être faite par un profil **différent de l'actionnaire**
(`verified_by <> owner_id`) ; une **preuve de clôture** est obligatoire (photo ou document dans le
bucket `action-evidence`).

**Vérification**

- [ ] Une preuve de clôture est-elle jointe ? `Attach closure proof` refuse d'envoyer sans preuve ;
      côté serveur, l'appel est également rejeté.
- [ ] Qui tente de vérifier ? Si c'est l'actionnaire lui-même → `error.selfVerification` :
      « An action cannot be verified by its own owner. » → il faut un autre vérificateur
      (`hse_officer` ou `site_director` habilité sur le site).
- [ ] Le compte du vérificateur est-il habilité sur le site concerned ? Un compte sans site ne voit
      rien (voir I3).
- [ ] L'action est-elle dans un statut valide pour la transition ? Le trigger
      `guard_action_transition` refuse les transitions interdites ; le message du serveur fait foi.

**Action**

- [ ] Si la preuve manque : le responsable de l'action joint la preuve puis `Submit for
      verification`.
- [ ] Si le vérificateur est l'actionnaire : désigner un autre vérificateur habilité.
- [ ] Si l'action a été rejetée : elle est repassée en `In progress`, `reopen_count` est incrémenté
      → le responsable reprend le traitement puis soumet à nouveau.
- [ ] Ne jamais contourner la règle en modifiant la base : la séparation des responsabilités est un
      garde-fou de sécurité (arbitrage A3).

**Escalade** : si aucun vérifiant habilité n'est disponible sur le site → responsable HSE (§ 5).

---

### I3 — Un compte sans site ne voit rien

**Symptôme** : un utilisateur connecté obtient des listes vides, « 0 row », ou l'IHM propose de
contacter l'administrateur.

**Vérification**

- [ ] Le compte a-t-il un `site_id` (ou une affiliation site) dans `profiles` ?
- [ ] Le compte est-il rattaché à une organisation ?
- [ ] Son rôle est-il activé ? (A2 : `worker`, `hse_officer` et `admin` sont pleinement
      opérationnels ; les autres rôles existent en base mais doivent être activés par
      l'administrateur.)
- [ ] La RLS filtre-t-elle bien par site ? Contrôle :
      `select id, site_id from public.profiles where id = '<user-uuid>';`
- [ ] L'utilisateur teste-t-il un événement d'un **autre** site ? Dans ce cas, le comportement est
      **normal** : la RLS renvoie 0 row et l'application affiche « You are not allowed to access
      this site. » (CR01). Ce n'est pas un incident.

**Action**

1. Si l'affectation de site est manquante : l'administrateur la renseigne dans `/admin/users` via
   `Set site scope`.
2. Vérifier l'activation du rôle.
3. Faire re-tester par l'utilisateur sur **son** site.

**Escalade** : si les données sont visibles hors périmètre → incident de sécurité (RLS) →
responsable d'exploitation et commanditaire (§ 5).

---

### I4 — Escalade critique non reçue

**Symptôme** : un événement `critical` est `Escalated` dans l'application, mais le destinataire de
l'escalade ne l'a pas vu / n'a pas acquitté.

**Rappel de la chaîne** (arbitrage A5, `app_settings.escalation.chain`) :

| Niveau | Destinataire | Condition |
|---|---|---|
| 1 | `hse_officer` du site | Immédiat, événement critique |
| 2 | `site_director` | Accident avec blessure ou arrêt de production |
| 3 | `company_officer` | Accident grave non clôturé à l'échéance |

**Vérification**

- [ ] L'escalade existe-t-elle dans `escalations` (route `/hse/escalations`) ? `acknowledged_at` est-il
      renseigné ?
- [ ] La notification in-app est-elle présente dans `/notifications` du destinataire ?
- [ ] L'e-mail est-il parti ? Contrôler `/admin/outbox` : statut, gabarit (`escalation_notified`),
      erreur.
- [ ] Le SMS de secours est-il parti ? (gabarit `sms_escalation`) Statut dans `sms_outbox`.
- [ ] `dispatch-outbox` a-t-il tourné dans la minute qui suit l'événement ?
- [ ] L'adresse email du destinataire est-elle renseignée et valide ?
- [ ] La règle d'anti-spam s'applique-t-elle ? (1 e-mail par destinataire et par événement ; au-delà
      de 5 e-mails de même catégorie en 24 h, regroupement en digest.) Un digest peut expliquer
      l'absence d'e-mail isolé.

**Action**

1. **Ne pas attendre le canal automatique** : prévenir le destinataire par téléphone si un danger
   grave est en cours. Le canal technique ne dispense pas de l'action humaine.
2. Relancer l'envoi via `/admin/outbox` → `Resend` si l'envoi a échoué.
3. Vérifier la configuration du destinataire (email, rôle, site) et corriger.
4. Si l'escalade n'a pas été **créée** : déclencher `escalate-critical` pour l'événement concerné.

**Escalade** : toute escalade critique non acquittée est un incident de niveau 2 → responsable
d'exploitation (§ 5).

---

### I5 — Corpus de consignes non validé, assistant indisponible

**Symptôme** : l'assistant ne renvoie aucun document ; message « No validated instruction is
available for this search. » ou « The assistant is unavailable. The event was not modified. »

**Rappel** (arbitrage A6) : un document n'est consultable par l'IA que si `status = 'validated'`
**et** `validated_by` est renseigné. Un document sans secteur ni site rattaché n'est pas consultable.

**Vérification**

- [ ] `AI_MODE` : vaut-il `rules` (moteur local, aucun fournisseur requis) ou `live` ?
- [ ] En mode `live` : `AI_API_BASE`, `AI_API_KEY`, `AI_MODEL` sont-ils définis et valides ?
- [ ] Le corpus contient-il au moins un document `validated` **pour le secteur du site** ?
- [ ] `validated_by` et `validated_at` sont-ils renseignés sur ces documents ?
- [ ] `review_due_at` : un document dont la revision est échue peut être signalé mais reste
      consultable — vérifier le contenu avant de l'utiliser comme référence.
- [ ] La version courante (`document_versions`) correspond-elle au document ?

**Action**

1. En mode `rules` : le moteur de règles local doit suffire. Si la recherche est vide, c'est que
   le corpus ne couvre pas le cas → faire valider une consigne correspondante.
2. En mode `live` : corriger les variables du fournisseur ou revenir à `AI_MODE=rules` (repli sûr).
3. Faire valider une version de consigne depuis `/admin/documents` → `Validate version` (validation
   par un référent, tracé dans `audit_log`).
4. **Ne jamais** poser `status = 'validated'` en base sans validation humaine réelle : c'est le
   garde-fou R8.

**Conséquence à signaler** : tant que le corpus n'est pas validé, l'assistant n'est pas
opérationnel. Ce n'est pas une panne du signalement : le reste de l'application reste pleinement
utilisable.

---

### I6 — Incident de sécurité (données de santé, fuite hors périmètre)

**Symptôme** : un profil non habilité semble lire `medical_records`, ou une URL signée sert un
fichier hors périmètre.

**Action immédiate**

- [ ] Désactiver le compte concerné (`Deactivate` dans `/admin/users`).
- [ ] Révoquer les sessions / réinitialiser le mot de passe.
- [ ] Conserver les traces : `/admin/audit`, `audit_log`, logs Supabase.
- [ ] Ne pas modifier la base pour « réparer » : conserver l'état pour l'analyse.

**Escalade** : immédiatement, hors circuit habituel (§ 5).

---

## 3. Procédure de restauration

### 3.1 Déclencheurs

- Base de données corrompue ou inaccessible.
- Perte de données constatée sur un site.
- Migration erronée appliquée en production.

### 3.2 Restauration depuis l'export hebdomadaire hors site

1. **Décider** (responsable d'exploitation) : l'export de la semaine est-il acceptable, ou faut-il
   restaurer à un point plus récent ?
2. Provisionner un projet Supabase **isolé** (ne jamais restaurer par-dessus la production en
   cas de doute).
3. Restaurer l'export :

```bash
pg_restore --clean --if-exists --no-owner \
  --dbname="$SUPABASE_DB_URL_RESTORE" "prevensante-<date>.dump"
```

4. Contrôler l'intégrité :
   - [ ] 20 tables métier présentes en schéma `public`.
   - [ ] RLS active sur les 20 tables.
   - [ ] 4 buckets Storage créés.
   - [ ] Extensions `pgcrypto`, `pg_cron`, `pg_net` actives.
   - [ ] 8 Edge Functions déployées sur le projet cible.
5. Rejouer un parcours métier minimal (connexion, signalement, triage, action, clôture).
6. **Basculer** : variables Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) et secrets Edge
   Functions (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), puis `vercel --prod`.
7. Contrôler l'outbox et les escalades en cours ; les lignes antérieures à la restauration sont
   perdues → **rejouer manuellement** les notifications critiques manquantes depuis `/admin/outbox`.
8. Consigner le compte rendu de restauration (date, export utilisé, durée, anomalies).

### 3.3 Après restauration

- [ ] Informer le commanditaire et le HSE du site pilote.
- [ ] Vérifier les actions correctives en retard : le compteur peut avoir changé.
- [ ] Vérifier que les comptes de test désactivés le restent.
- [ ] Programmer le prochain test de restauration trimestriel si la date était dépassée.

---

## 4. Rollback rapide

| Situation | Action | Délai cible |
|---|---|---|
| Régression front | `vercel rollback <deployment>` | < 15 min |
| Problème de configuration (variable, secret) | Corriger la variable, redéployer | < 30 min |
| Migration erronée | Script de rollback de `supabase/migrations/README.md`, sinon restauration § 3 | selon criticité |
| Perte de données | Restauration § 3 | < 4 h |

Avant toute modification en base : **export de l'état courant** (point de restauration). Après toute
modification : contrôle de l'outbox, des escalades et du journal d'audit.

---

## 5. Qui contacter

| Niveau | Rôle | Contact | Délai |
|---|---|---|---|
| N1 | Administrateur de l'application (`admin`) | à compléter par le commanditaire — adresse / téléphone | < 1 h ouvré |
| N2 | HSE du site pilote (responsable `hse_officer`) | à compléter — nom, téléphone | immédiat si `critical` |
| N3 | Responsable d'exploitation / technique | à compléter — nom, téléphone, astreinte | < 1 h |
| N4 | Commanditaire (arbitrages A1, A10, périmètre, budget) | à compléter — nom, téléphone | selon urgence |
| N5 | Fournisseur Supabase (support) | portail officiel Supabase — jamais de secret par e-mail | incident plateforme |
| N5 | Fournisseur SMTP / SMS | à compléter — support client | files en échec récurrentes |
| N5 | Hébergeur du stockage secondaire de sauvegarde | à compléter | perte de sauvegarde |

> Les contacts nominatifs ne sont pas renseignés dans ce document : ils dépendent de
> l'organisation du commanditaire et doivent être complétés avant la mise en production.

**Règle d'escalade** : un incident `critical` (danger grave non traité, escalade non acquittée,
fuite de données) remonte **immédiatement** au niveau N2 **et** N3, sans attendre le créneau
ouvré.

---

## 6. Tâches récurrentes

| Tâche | Périodicité | Par | Durée indicative |
|---|---|---|---|
| Consultation de l'outbox en échec | Quotidienne | Responsable d'exploitation | 10 min |
| Contrôle des escalades ouvertes | Quotidienne | HSE du site | 10 min |
| Revue du journal d'audit | Hebdomadaire | Administrateur | 30 min |
| Export hebdomadaire hors site | Hebdomadaire | Responsable d'exploitation | 30 min |
| Test de restauration | Trimestrielle | Responsable d'exploitation | 2 h |
| Revue des actions correctives en retard | Mensuelle | HSE + direction de site | 1 h |
| Revue des documents dont la revision approche (`review_due_at` < 30 j) | Mensuelle | Référent documentaire | 1 h |
| Rotation des secrets (SMTP, SMS, IA, clés de service) | Semestrielle | Responsable d'exploitation | 1 h |

---

## 7. Modèles de consignation

**Incident**

```
Date/heure (UTC) :
Détecté par :
Symptôme :
Périmètre (site, tables, canaux) :
Cause identifiée :
Action corrective :
Statut final :
Escadé à (niveau, nom) :
```

**Restauration**

```
Date/heure (UTC) :
Export utilisé (date du dump) :
Projet cible :
Contrôles d'intégrité (résultat) :
Perte de données constatée :
Notifications rejouées :
Destinataires informés :
```
