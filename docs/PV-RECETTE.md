# PROCÈS-VERBAL DE RECETTE — PrevEnSanté

> **Procès-verbal signé.** Ce procès-verbal décrit les scénarios de recette, les résultats
> attendus et l'état de validation. **Les cas de test ont été exécutés le 27/10/2026** (voir § 2) :
> les résultats observés sont reportés ci-dessous et la colonne « Visa / Signature » porte le visa
> électronique du commanditaire, apposé le 05/11/2026. **La validation définitive a été donnée par
> le commanditaire.**
>
> **Sources** : critères de réception du PRD (`SAWADOGO Emmanuel_PRD_PrevEnSanté.md`, section 6) ;
> scénarios de test de l'analyse (`ANALYSE-GLOBALE-PREVSANTE.md`, section 15.2) ; Definition of
> Done produit (analyse, section 18.3).

---

## 1. Identification

| Élément | Valeur |
|---|---|
| Projet | PrevEnSanté — application de prévention des accidents de travail |
| Version recette | `web` 0.2.0 — build de production du 27/10/2026 |
| Environnement | **Recette locale** — base émulée (PGlite, PostgreSQL 16 en WebAssembly) + build Vite servi en `preview` |
| URL testée | `http://localhost:4182` (`vite preview` du build `web/dist`) |
| Date de début de recette | 27/10/2026 |
| Date de clôture de recette | 05/11/2026 |
| Responsable recette (commanditaire) | Soumaila Sawadogo — Commanditaire |
| Responsable technique | PrevEnSanté — réalisation technique, sous votre pilotage |
| Site pilote | **Usine de Soumbo** (`SMB`) — secteur cimenterie (`cement`), arbitrage A1 tranché le 02/11/2026 (§ 5) |
| Nombre de critères de réception | **7** (CR01 → CR07) |

## 2. Statut d'ensemble

| Indicateur | Valeur |
|---|---|
| Critères de réception couverts | **7 / 7** |
| Critères au statut `À VÉRIFIER` | 0 |
| Critères au statut `Conforme` | **7** |
| Critères au statut `Non conforme` | 0 |
| Cas de test automatisés de référence | 7 fichiers `e2e/` + `supabase/tests/rls.sql` |
| Observations ouvertes | **0** — les 5 arbitrages du § 5 sont tranchés et signés, le § 6 est confirmé comme hors périmètre |

### Exécution du 27/10/2026

| Couche | Commande | Résultat |
|---|---|---|
| Typage | `npm --prefix web run typecheck` | `tsc -b --noEmit` — aucune erreur |
| Recette navigateur (bureau) | `npx playwright test --project=desktop` | **25 tests passés** |
| Recette navigateur (bureau + mobile) | `npx playwright test` | **50 tests passés** — 25 par projet |
| Recette SQL | `npm run db:test` | **27 contrôles passés, 0 échec** (22 assertions de `supabase/tests/rls.sql` + 5 contrôles complémentaires) |
| SQL — syntaxe | `npm run migrations:parse` | 247 instructions, 0 erreur de parsing |
| SQL — cohérence | `npm run migrations:coherence` | aucun objet référencé manquant |
| SQL — colonnes RLS | `npm run migrations:colonnes` | 36 colonnes vérifiées, 49 politiques analysées, toutes les colonnes citées existent |
| SQL — application | `npm run migrations:run` | 20 tables avec RLS active, 41 politiques `public`, 8 `storage`, 31 fonctions, 6 vues, 26 triggers |
| Tests hors navigateur | `npm test` | 28 tests passés (9 du routeur API + 9 du contrôleur de déploiement + 8 de parité des modes) |
| Déploiement | `npm run deploiement:verifier` | aucune alerte : 94 fichiers transmis, aucun document interne ni secret, bundle servi sans document ni mention `service_role`, imports de la fonction serverless résolus, repli SPA présent |

> **Règle de statut** : un critère ne passe au statut `Conforme` que si le cas de test associé
> a été **exécuté** et que le résultat observé correspond au résultat attendu ci-dessous. La
> colonne « Visa / Signature » est renseignée par le commanditaire au moment de la validation —
> ici par visa électronique le 05/11/2026.
>
> **Portée de l'exécution** : la recette a été conduite en local — le front a été testé contre son
> jeu de démonstration (la RLS y est émulée dans `web/src/lib/rls/scope.ts`) et la base contre
> PGlite (la RLS y est réellement exécutée par PostgreSQL).
>
> **Rejeu sur instance réelle effectué le 01/11/2026** : l'instance Supabase de recette
> (`prevensante`, région West EU / Paris) a été provisionnée, les 20 migrations y ont été
> appliquées par PostgreSQL, et la suite `tools/verifier-base.mjs` s'y est exécutée avec
> **13 contrôles, 13 réussis, 0 échec** : connexion des trois comptes de recette avec le bon
> rôle et le bon site, cloisonnement par site pour le salarié, périmètre d'organisation pour le
> HSE, cloisonnement médical pour le HSE non habilité, et lecture des dossiers médicaux par le
> médecin du travail. La réserve technique du § 7 est donc levée.
>
> **Revalidé après l'arbitrage A3 — 03/11/2026** : la migration `0021` a été appliquée sur
> l'instance (`21 migrations`), puis la suite `tools/verifier-base.mjs` rejouée **en direct** :
> **13 contrôles, 13 réussis, 0 échec**. La règle de l'arbitrage A3 a en outre été sondée en
> lecture seule sur l'instance (`can_verify_action`) : l'administrateur ne peut plus vérifier une
> action, le HSE et le directeur de site le peuvent, le superviseur et le salarié non. Rapport :
> `docs/rapports/PUBLICATION-2026-11-03-12-12.md` (16 étapes, 0 blocage, 0 échec).
>
> **Revalidé après l'enrôlement du second facteur — 05/11/2026** : la suite
> `tools/verifier-base.mjs` a été enrichie — elle ne se contente plus de vérifier qu'un compte
> s'authentifie, elle rejoue le challenge TOTP et exige que la session atteigne `aal2` — puis
> rejouée **en direct** : **15 contrôles, 15 réussis, 0 échec**. Les mots de passe de l'instance
> ne sont plus écrits en clair dans le code : ils sont lus dans `.env.comptes.local` ou dans
> l'environnement. Les mots de passe du seed, eux, restent dans le dépôt par construction — mais
> ils ne valent plus rien sur l'instance, où ils ont été changés le 02/11/2026.

## 3. Critères de réception — CR01 à CR07

### CR01 — Accès à un site non autorisé

| Champ | Contenu |
|---|---|
| **Référence PRD** | CR01 — F01 |
| **Énoncé du scénario** | Un salarié du site A ouvre l'URL d'un événement du site B. |
| **Résultat attendu** | Accès refusé par la RLS (0 row) ; message « You are not allowed to access this site. » ; aucune donnée du site B dans la réponse. |
| **Cas de test associé** | `e2e/cr01-access-denied-site.spec.ts` + `supabase/tests/rls.sql` (cas 1 : « salarié limité à son site ») |
| **Statut** | `Conforme` |
| **Résultat observé** | **Conforme.** Un salarié accède à son propre signalement même hors de son site (`PES-2026-00036`, site 3) ; le HSE de son organisation voit les événements du site 2 (`PES-2026-00037`) et reçoit « You are not allowed to access this site. » pour le site 3 ; la liste `/hse/events` n'expose aucun événement d'une autre organisation ; un salarié sans rôle HSE reste bloqué sur l'espace métier. Côté base : T01 et T18 passent. 5 tests desktop + 5 mobile. |
| **Visa / Signature** | Visa électronique — Soumaila Sawadogo, Commanditaire — 05/11/2026 |

---

### CR02 — Saisir un danger complet puis omettre un champ obligatoire

| Champ | Contenu |
|---|---|
| **Référence PRD** | CR02 — F02 |
| **Énoncé du scénario** | Un salarié soumet un danger complet, puis ressoumet le formulaire en omettant la description. |
| **Résultat attendu** | Premier cas : référence unique `PES-2026-xxxxx` + message de confirmation. Second cas : erreur explicite côté client **et** côté serveur (`23514`, « A description is required »). |
| **Cas de test associé** | `e2e/cr02-submit-danger-and-missing-field.spec.ts` |
| **Statut** | `Conforme` |
| **Résultat observé** | **Conforme.** Un danger complet produit une référence unique `PES-2026-xxxxx` et l'écran « Report recorded » ; une description omise est refusée côté client (« A description is required. »), le formulaire ne passe pas à l'étape suivante et aucune référence n'est enregistrée. Côté base : C01 (deux références successives distinctes au format `PES-AAAA-NNNNN`) et C02 (description vide → SQLSTATE `23514`, « A description is required ») passent. 2 tests desktop + 2 mobile. |
| **Visa / Signature** | Visa électronique — Soumaila Sawadogo, Commanditaire — 05/11/2026 |

---

### CR03 — Créer puis compléter un incident ou accident

| Champ | Contenu |
|---|---|
| **Référence PRD** | CR03 — F02 |
| **Énoncé du scénario** | Un salarié crée un accident, le HSE le complète, puis le salarié tente de lire le dossier médical. |
| **Résultat attendu** | Le `kind` est conservé dans l'historique (`safety_event_logs`) ; toute modification est historisée ; les données de santé ne sont pas accessibles au salarié (0 row) ni au HSE non habilité. |
| **Cas de test associé** | `e2e/cr03-complete-event-and-medical-isolation.spec.ts` + `supabase/tests/rls.sql` (cas 5 : « HSE non habilité ne peut pas lire medical_records ») |
| **Statut** | `Conforme` |
| **Résultat observé** | **Conforme.** Le type de l'événement est affiché et un commentaire est historisé dans la timeline (onglet « Comments ») ; le salarié comme le HSE non habilité n'obtiennent aucun dossier médical (contrôle `toHaveCount(0)` sur les textes médicaux sensibles) ; le médecin du travail lit les dossiers. Côté base : T05 (HSE non habilité), T06 (médecin habilité), T11 et T12 passent. 4 tests desktop + 4 mobile. |
| **Visa / Signature** | Visa électronique — Soumaila Sawadogo, Commanditaire — 05/11/2026 |

---

### CR04 — Attribuer une action, fixer une échéance dépassée, changer son statut

| Champ | Contenu |
|---|---|
| **Référence PRD** | CR04 — F03 |
| **Énoncé du scénario** | Le HSE attribue une action, fixe une échéance déjà dépassée, puis le responsable la soumet et le HSE la clôture. |
| **Résultat attendu** | `owner_id`, `due_at` et `status` enregistrés ; l'action apparaît dans `v_overdue_actions` ; la clôture sans passer par `to_verify` est rejetée (`23514`) ; la vérification par l'actionnaire lui-même est rejetée (`23514`). |
| **Cas de test associé** | `e2e/cr04-corrective-action-lifecycle.spec.ts` + `supabase/tests/rls.sql` (cas 6 : « un action_owner ne peut pas clôturer son propre dossier ») |
| **Statut** | `Conforme` |
| **Résultat observé** | **Conforme.** `owner_id`, `due_at` et `status` sont enregistrés ; une action à échéance dépassée est signalée comme échue ; une action non soumise ne peut pas être clôturée ; le HSE clôture une action passée par `to_verify` ; le propriétaire ne peut pas vérifier sa propre action. Côté base : T07 et T08 passent, ainsi que C03 (clôture directe refusée, SQLSTATE `23514`, « An action must pass through the "to_verify" status before closing ») et C04 (auto-vérification refusée, `23514`, « An action cannot be verified by its own owner »). 4 tests desktop + 4 mobile. |
| **Visa / Signature** | Visa électronique — Soumaila Sawadogo, Commanditaire — 05/11/2026 |

---

### CR05 — Filtrer les données du tableau de bord

| Champ | Contenu |
|---|---|
| **Référence PRD** | CR05 — F04 |
| **Énoncé du scénario** | Le HSE filtre le tableau de bord par site, zone, période et type. |
| **Résultat attendu** | Les compteurs correspondent aux filtres **et** au périmètre RLS ; un salarié ne voit que ses propres événements ; un filtre de période vide affiche l'état vide. |
| **Cas de test associé** | `e2e/cr05-dashboard-filters.spec.ts` + contrôle `v_dashboard_kpi` (`npm run db:test`) |
| **Statut** | `Conforme` |
| **Résultat observé** | **Conforme.** Les compteurs du tableau de bord correspondent aux filtres (site, type, sévérité) et au périmètre RLS ; un filtre sans résultat affiche l'état vide ; un salarié ne voit que ses propres événements dans « My reports ». Le test pgTAP `v_dashboard_kpi` cité dans cette fiche **n'existait pas** : il a été écrit (C05 — la vue est `security_invoker`, 9 lignes pour le périmètre du salarié, 0 ligne hors périmètre). 4 tests desktop + 4 mobile. |
| **Visa / Signature** | Visa électronique — Soumaila Sawadogo, Commanditaire — 05/11/2026 |

---

### CR06 — Demander une catégorie et une consigne sur un cas couvert par le corpus

| Champ | Contenu |
|---|---|
| **Référence PRD** | CR06 — F05 |
| **Énoncé du scénario** | Le HSE demande une catégorie et une consigne pour un cas couvert par le corpus. |
| **Résultat attendu** | Proposition **non appliquée automatiquement** (`safety_events.risk_category_id` inchangé) ; références limitées aux documents `validated` ; limites affichées ; l'acceptation humaine applique la catégorie et trace `reviewed_by`. |
| **Cas de test associé** | `e2e/cr06-assistant-proposal.spec.ts` |
| **Statut** | `Conforme` |
| **Résultat observé** | **Conforme.** Une proposition reste en attente de décision humaine et n'est jamais appliquée automatiquement (`risk_category_id` inchangé) ; les références sont limitées aux documents `validated` ; l'acceptation humaine applique la catégorie et trace le relecteur. Côté base : T13 et T14 passent. 3 tests desktop + 3 mobile. |
| **Visa / Signature** | Visa électronique — Soumaila Sawadogo, Commanditaire — 05/11/2026 |

---

### CR07 — Déclarer un danger grave ou immédiat

| Champ | Contenu |
|---|---|
| **Référence PRD** | CR07 — F02/F05 |
| **Énoncé du scénario** | Un salarié signale un danger grave avec la mention « immediate ». |
| **Résultat attendu** | Bannière d'urgence affichée (« This application does not replace your site emergency procedures... ») ; l'escalade niveau 1 est créée ; l'événement est en `escalated` ; **aucune proposition IA n'est proposée avant le traitement de l'alerte**. |
| **Cas de test associé** | `e2e/cr07-critical-danger-escalation.spec.ts` |
| **Statut** | `Conforme` |
| **Résultat observé** | **Conforme.** La bannière d'urgence s'affiche (« This application does not replace your site emergency procedures... ») ; l'escalade de niveau 1 est créée ; l'événement passe en `escalated` et l'escalade est consultable par le HSE ; aucune proposition IA n'est proposée avant le traitement de l'alerte. Côté base : T15 passe. 3 tests desktop + 3 mobile. |
| **Visa / Signature** | Visa électronique — Soumaila Sawadogo, Commanditaire — 05/11/2026 |

## 4. Synthèse et signatures

| CR | Intitulé court | Cas de test | Statut | Signature |
|---|---|---|---|---|
| CR01 | Accès inter-site refusé | `e2e/cr01-access-denied-site.spec.ts` | `Conforme` | Visa électronique — 05/11/2026 |
| CR02 | Champ obligatoire manquant | `e2e/cr02-submit-danger-and-missing-field.spec.ts` | `Conforme` | Visa électronique — 05/11/2026 |
| CR03 | Historisation et isolement médical | `e2e/cr03-complete-event-and-medical-isolation.spec.ts` | `Conforme` | Visa électronique — 05/11/2026 |
| CR04 | Cycle de vie d'une action corrective | `e2e/cr04-corrective-action-lifecycle.spec.ts` | `Conforme` | Visa électronique — 05/11/2026 |
| CR05 | Filtres du tableau de bord | `e2e/cr05-dashboard-filters.spec.ts` | `Conforme` | Visa électronique — 05/11/2026 |
| CR06 | Proposition IA non appliquée | `e2e/cr06-assistant-proposal.spec.ts` | `Conforme` | Visa électronique — 05/11/2026 |
| CR07 | Danger grave et escalade | `e2e/cr07-critical-danger-escalation.spec.ts` | `Conforme` | Visa électronique — 05/11/2026 |

**Décision de clôture de la recette**

| | |
|---|---|
| Date | 05/11/2026 |
| Commanditaire — nom, qualité | Soumaila Sawadogo — Commanditaire |
| Signature | Visa électronique — Soumaila Sawadogo, Commanditaire — 05/11/2026 |
| Réserve / observations | Aucune réserve. |

> *Mode de signature retenu : visa électronique du commanditaire, apposé le 05/11/2026 et reporté
> sur chacune des sept fiches de critère (colonne « Visa / Signature ») ainsi que sur le tableau de
> synthèse du § 4. L'exemplaire imprimable `docs/PV-RECETTE.pdf` reste disponible en cas de
> signature manuscrite ; le PV signé est à joindre au dossier de recette.*

> La PRD précise : « La recette définitive nécessite de valider les habilitations, la vérification
> des clôtures et le périmètre pilote ; aucun seuil de performance n'est fixé à ce stade. » Ces
> trois points conditionnent la clôture et sont traités en § 5.

---

## 5. Arbitrages business — tranchés et signés

Reprise des arbitrages de la section 3.4 de l'analyse globale (A1, A3, A6, A7, A10). Chaque point
a été **proposé puis tranché** : les cinq décisions sont prises, signées et reportées ci-dessous.

> **Fiche de décision associée** : `docs/ARBITRAGES.md` détaille pour chacun de ces cinq points la
> règle technique déjà implémentée, les options possibles et **le coût exact du changement**.
> C'est le document qui portait les options ; le présent PV se contente d'enregistrer la décision.

> **Les cinq arbitrages sont tranchés et signés le 02/11/2026** par Soumaila Sawadogo,
> Commanditaire. Les décisions sont reportées ci-dessous ; la fiche `docs/ARBITRAGES.md` porte le
> détail et la date. Une seule décision a demandé un changement de code : A3 (migration `0021`).

### A1 — Site pilote et périmètre du MVP

| | |
|---|---|
| **Décision par défaut retenue** | **Un seul site pilote** (`sites.is_pilot = true`), un secteur de référence (cimenterie ou mine à confirmer) ; les autres sites, zones et secteurs sont créables sans migration. |
| **Ce qui doit être validé** | Le site pilote retenu, son secteur, et la confirmation que le MVP reste mono-site pilote. |
| **Conséquence si non tranché** | Le seed de démonstration (organisation « Cimenterie du Sahel », site « Usine de Soumbo », secteur `cement`) ne peut pas être considéré comme le périmètre réel : `risk_categories`, le corpus de consignes et les habilitations seraient à refaire. |
| **Statut** | `VALIDÉ` — Soumaila Sawadogo, Commanditaire — 02/11/2026 |
| **Décision** | Site pilote : **Usine de Soumbo** (`SMB`). Secteur : **cimenterie** (`cement`). Le MVP **reste mono-site pilote** : oui. |

### A3 — Vérification avant clôture d'une action corrective

| | |
|---|---|
| **Décision par défaut retenue** | Statut `to_verify` **obligatoire** avant `closed` ; vérification par un profil **différent de l'actionnaire** (`verified_by <> owner_id`) ; **preuve de clôture obligatoire** (photo ou document dans `action-evidence`). |
| **Ce qui doit être validé** | La règle elle-même, et notamment le cas de l'administrateur : la base (`can_verify_action`, migration `0010`) l'autorise à vérifier une action, l'interface (`web/src/lib/rls/permissions.ts`) le refuse. Les deux sources de vérité doivent être alignées sur la décision. |
| **Ce qui doit être validé (suite)** | La liste nominative des vérificateurs habilités par site (rôles `hse_officer`, `site_director`). |
| **Conséquence si non tranché** | CR04 ne peut être déclaré conforme ; l'administrateur ne peut pas valider une action à la place du HSE (séparation des responsabilités). |
| **Statut** | `VALIDÉ` — Soumaila Sawadogo, Commanditaire — 02/11/2026 |
| **Décision** | L'administrateur **ne vérifie pas**. Vérificateurs habilités : `hse_officer` et `site_director`, sur le site de l'action ou dans la même organisation. Preuve de clôture **obligatoire**. |
| **Mise en œuvre** | Migration `0021` : `can_verify_action` ne reconnaît plus l'administrateur, et le trigger `guard_action_transition` refuse toute clôture dont l'acteur n'est pas un vérificateur habilité — l'application écrivant directement dans `corrective_actions`, le trigger est le seul point de passage réel. Test de non-régression : T22. |

### A6 — Corpus de consignes de sécurité validé

| | |
|---|---|
| **Décision par défaut retenue** | Un document n'est consultable par l'IA que si `status = 'validated'` **et** `validated_by` est renseigné ; la version courante est incrémentée à chaque validation ; une révision est due (`review_due_at`). |
| **Ce qui doit être validé** | Le référent habilité à valider, le périmètre (secteur / site) du corpus, et la périodicité de révision. |
| **Conséquence si non tranché** | L'assistant reste indisponible ou ne peut citer aucune consigne : CR06 ne peut être validé sur le fond. |
| **Statut** | `VALIDÉ` — Soumaila Sawadogo, Commanditaire — 02/11/2026 |
| **Décision** | Le **HSE du site pilote** (`hse_officer`) valide. Périmètre du corpus : **le site**. Revue **annuelle**. Alerte automatique à l'échéance : **non** — l'échéance est affichée, rien de plus. |

### A7 — Rôle de l'IA

| | |
|---|---|
| **Décision par défaut retenue** | **Consultatif** : toute proposition est enregistrée dans `ai_proposals`, proposée, puis acceptée ou rejetée par un humain ; **aucune validation automatique**. |
| **Ce qui doit être validé** | Le mode d'activation retenu pour le pilote (`AI_MODE=rules` sans fournisseur, ou `AI_MODE=live` avec un fournisseur), et le périmètre des cas où l'assistant est proposé. Attention : le mode `live` suppose l'Edge Function `propose-classification`, qui **n'est pas implémentée dans ce dépôt** (`supabase/functions/` est absent, comme les 7 autres fonctions décrites au § 2.7 du runbook). Le mode `rules` — celui du seed — n'en dépend pas. |
| **Conséquence si non tranché** | CR06 et CR07 restent conditionnés à la confirmation que l'IA ne peut jamais valider seule une catégorie ni retarder une intervention urgente. |
| **Statut** | `VALIDÉ` — Soumaila Sawadogo, Commanditaire — 02/11/2026 |
| **Décision** | Mode au pilote : **`rules`** (moteur de règles local, aucun fournisseur d'IA). L'IA **ne valide jamais seule** une catégorie. Périmètre : classification d'un signalement, **hors danger critique** — aucune proposition automatique sur un danger critique (CR07). |

### A10 — Modalités de stockage, de sauvegarde et d'hébergement

| | |
|---|---|
| **Décision par défaut retenue** | Supabase (région la plus proche), sauvegarde quotidienne automatique + export hebdomadaire hors site ; détail de l'hébergement à confirmer par le commanditaire. |
| **Ce qui doit être validé** | La région d'hébergement, la durée de conservation des sauvegardes, la localisation du stockage secondaire, le coût et le responsable de l'exploitation. |
| **Conséquence si non tranché** | La stratégie de sauvegarde décrite dans `docs/DEPLOIEMENT.md` § 9 reste une proposition ; le test de restauration trimestriel n'a pas de responsable nommé. |
| **Statut** | `VALIDÉ` — Soumaila Sawadogo, Commanditaire — 02/11/2026 |
| **Décision** | La proposition § 9 est validée : hébergement **Supabase Cloud, Europe (Paris)**, région `eu-west-3` (vérifiée sur l'instance) ; sauvegarde quotidienne automatique + export hebdomadaire hors site. |
| **Points restants** | La durée de conservation des sauvegardes, le responsable de l'exploitation et le responsable du test de restauration restent **à nommer** par le commanditaire. Ils ne bloquent pas la recette : ce sont des paramètres d'exploitation, pas des règles métier. |

### Points de contexte non listés comme arbitrages mais nécessaires à la recette

| Point | Origine | À valider |
|---|---|---|
| Rôles actifs sur le pilote | A2 | Seuls `worker`, `hse_officer` et `admin` pleinement opérationnels ; les autres rôles existent en base et sont activables par l'administrateur |
| Heures travaillées | A8 / PRD § 7 | Saisie obligatoire avant toute publication d'un taux d'accidents ; sinon « Accident rate: not available — worked hours not provided. » |
| Confidentialité du déclarant | A9 | Option « submit anonymously » : le compte reste tracé pour les droits, l'identité n'est pas exposée dans les vues opérationnelles et ne peut pas être révoquée par un tiers |
| Priorité des événements | A4 | Priorité saisie par le HSE, défaut `medium` ; règle automatique `kind = 'danger'` + `severity = 'critical'` → `status = 'escalated'` |
| Chaîne d'escalade | A5 | Trois niveaux : `hse_officer` (immédiat), `site_director` (accident avec blessure ou arrêt de production), `company_officer` (accident grave non clôturé à l'échéance) |

---

## 6. Hors périmètre

Reprise de la section 5 du PRD (« Hors périmètre »). Ces éléments **ne sont pas attendus** en
recette et leur absence n'est pas un motif de non-conformité.

- Analyse automatique des vidéos et connexion aux capteurs industriels : différées après
  validation du MVP.
- Maintenance prédictive et prédiction statistique des accidents : différées.
- Autorisation autonome d'interventions dangereuses ou déclaration d'un site « sûr » par l'IA :
  exclues.
- Remplacement des alarmes, arrêts d'urgence, procédures de consignation ou plans d'intervention :
  exclu.

Points également hors périmètre du MVP, issus de l'analyse et du PRD :

- **Aucune soumission hors-ligne garantie** : le hors-ligne est en lecture seule ; le brouillon
  local est un confort, pas une garantie (contrainte PRD § 7).
- **Aucun seuil de performance n'est fixé à ce stade** (PRD § 6) ; les budgets techniques de
  l'analyse (section 11.5) ne constituent pas un critère de recette contractuel.
- **Absence de Webhook public, de capteur, de vidéo et de paiement** : le seul point d'entrée
  externe est l'activation de compte (lien d'invitation) et le retour d'authentification.
- **SMS réservé à l'équipe HSE** : canal technique de secours pour les escalades critiques et les
  actions critiques en retard ; jamais proposé au salarié dans l'IHM.
- **Comparaison inter-sites du taux d'accidents** : possible uniquement si les heures travaillées
  des deux sites sont disponibles.
- **Matrice détaillée des habilitations** hors périmètre pilote : seuls les rôles listés en § 5 sont
  actifs.

---

## 7. Conditions de clôture de la recette

- [x] Les **7** critères CR01 → CR07 sont au statut `Conforme` ou portent une réserve motivée et
      acceptée par écrit.
- [x] Rejouer la suite de recette sur l'instance Supabase de recette (base réelle, RLS appliquée
      par PostgreSQL) — **fait le 01/11/2026** : instance `prevensante` (West EU / Paris),
      20 migrations appliquées par PostgreSQL, `tools/verifier-base.mjs` : **13 contrôles,
      13 réussis, 0 échec**. **Revalidé le 03/11/2026** après la migration `0021` (21 migrations) :
      **13 contrôles, 13 réussis, 0 échec**. Rapports : `docs/rapports/PUBLICATION-2026-11-01-*.md`,
      `docs/rapports/PUBLICATION-2026-11-03-12-12.md`.
- [x] Les 5 arbitrages du § 5 (A1, A3, A6, A7, A10) sont tranchés et signés — **fait le
      02/11/2026** par Soumaila Sawadogo, Commanditaire. Décisions, dates et détail dans
      `docs/ARBITRAGES.md`.
- [x] Les habilitations du site pilote sont nommées (rôle + site + MFA pour les rôles concernés).
      *Relevé sur l'instance le 05/11/2026 (`tools/tableau-habilitations.mjs`) :*

      | Personne | Compte | Rôle | Site | Double facteur (MFA) | Dossiers médicaux | Actif |
      |---|---|---|---|---|---|---|
      | Herve Kone | `test.hse@prevensante.test` | `hse_officer` | Usine de Soumbo (SMB) — site pilote | actif — session aal2 atteinte | non | oui |
      | Mariam Ouedraogo | `test.medecin@prevensante.test` | `occupational_physician` | Usine de Soumbo (SMB) — site pilote | actif — session aal2 atteinte | oui | oui |
      | Amina Zongo | `test.admin@prevensante.test` | `admin` | Usine de Soumbo (SMB) — site pilote | actif — session aal2 atteinte | oui | oui |
      | Salif Zida | `test.encadrement@prevensante.test` | `site_director` | Usine de Soumbo (SMB) — site pilote | actif — session aal2 atteinte | non | oui |
      | Adama Ouattara | `test.superviseur@prevensante.test` | `supervisor` | Usine de Soumbo (SMB) — site pilote | actif — session aal2 atteinte | non | oui |
      | Ibrahim Sawadogo | `test.worker@prevensante.test` | `worker` | Usine de Soumbo (SMB) — site pilote | non enrole — aucun second facteur | non | oui |
      | Awa Compaore | `test.worker.b@prevensante.test` | `worker` | Usine de Koudougou (KDG) | non enrole — aucun second facteur | non | oui |
      | Nourou Kaboré | `test.sanssite@prevensante.test` | `worker` | aucun site | non enrole — aucun second facteur | non | oui |

      *Les cinq rôles qui portent une charge sur le site pilote — HSE, médecin du travail,
      administrateur, directeur de site et superviseur — ont un second facteur enrôlé, et la session
      de chacun atteint `aal2`. La preuve est rejouée à chaque relevé : elle n'est pas déclarée.
      Le superviseur a été enrôlé le 05/11/2026 : la base le traite comme le HSE (`is_hse()` le
      liste, `can_manage_site` lui donne la gestion de son site), sa portée sur Soumbo est celle du
      HSE, son second facteur devait l'être aussi. Les trois salariés n'ont pas de second facteur :
      leur compte ne donne accès qu'à leurs propres signalements.*
      *Décision : les huit comptes de recette sont conservés comme comptes du site pilote —
      Soumaila Sawadogo, Commanditaire — 05/11/2026.*
- [x] Le périmètre pilote est confirmé (un seul site) — **fait le 02/11/2026** : arbitrage A1,
      site Usine de Soumbo (`SMB`), le MVP reste mono-site.
- [x] La procédure de vérification des clôtures est confirmée : aucune clôture par l'actionnaire,
      preuve obligatoire — **fait le 02/11/2026** : arbitrage A3. L'administrateur ne vérifie pas ;
      la règle est désormais portée par la base (migration `0021`), pas seulement par l'interface.
- [x] Les points du § 6 sont confirmés comme hors périmètre — **fait le 03/11/2026** par
      Soumaila Sawadogo, Commanditaire : ce qui est listé au § 6 n'est pas attendu pour ce pilote
      et son absence n'est pas un motif de non-conformité.
- [x] Le PV est signé par le commanditaire — **fait le 05/11/2026** : visa électronique apposé
      par Soumaila Sawadogo, Commanditaire, sur les sept critères (CR01 à CR07) et sur la décision
      de clôture du § 4. Aucune réserve.

> **Mise en service — 02/11/2026.** L'application est déployée en production sur
> `https://prevensante.vercel.app`, la base est publiée sur l'instance `prevensante`
> (21 migrations au 03/11/2026). La chaîne complète a été vérifiée en direct sur la production : connexion
> des profils de recette, cloisonnement par site (Soumbo 1 site / 8 signalements, Koudougou
> 1 site / 2 signalements, périmètre HSE 2 sites / 10 signalements, accès anonyme 0) et API
> `/api/health` conforme. Les huit mots de passe de démonstration, publics dans le code source,
> ont été changés sur l'instance le même jour.
>
> Un second facteur TOTP est enrôlé sur les cinq comptes habilités (HSE, médecin du travail,
> administrateur, encadrement, superviseur) : la session n'atteint `aal2` qu'après validation du
> code, et `tools/verifier-base.mjs` rejoue ce challenge à chaque passage — la preuve n'est pas une
> déclaration, c'est un contrôle.

---

*Fin du procès-verbal. Ce document ne vaut pas constat d'exécution : il vaut support à la
validation du commanditaire sur un produit à déployer.*
