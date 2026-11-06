# Fiche de décision — les 5 arbitrages du commanditaire

> **Objet.** Les arbitrages A1, A3, A6, A7 et A10 du § 5 du PV de recette ont été **tranchés et
> signés le 02/11/2026** par SAWADOGO Soumaila, Commanditaire. Pour chacun, une règle technique est
> **déjà écrite et testée** dans le dépôt, et la décision retenue est reportée dans la
> « Ligne à cocher » correspondante. Le corps de chaque fiche conserve l'analyse : elle dit ce que
> chaque décision aurait coûté si elle avait été différente.
>
> **Références.** `docs/PV-RECETTE.md` § 5 et § 7 · `docs/DEPLOIEMENT.md` § 2.4, § 2.7, § 9, § 13 ·
> `supabase/migrations/` (0001 → 0021).
>
> **État au 03/11/2026** : la chaîne complète est verte (28 tests automatisés, 27 contrôles SQL,
> 50 tests navigateur, 0 vulnérabilité) et la migration `0021`, qui aligne la base sur l'arbitrage
> A3, est appliquée sur l'instance de recette. Un seul arbitrage a demandé un changement de code.

---

## Comment lire cette fiche

Chaque arbitrage suit la même structure :

1. **La question** — ce qu'il faut trancher, en une phrase.
2. **Ce qui est déjà en place** — la règle par défaut, et l'endroit exact du code qui l'applique.
3. **Les options** — avec le coût réel du changement.
4. **La ligne à cocher** — à remplir, à signer.

> **Une divergence signalée** dans une fiche n'est pas un reproche : c'est un écart entre deux
> sources de vérité (la base et l'interface) qu'un arbitrage doit faire disparaître. Tant qu'il
> subsiste, les deux modes peuvent se comporter différemment.

---

## A1 — Site pilote et périmètre du MVP

**La question.** Quel site sert de pilote, sur quel secteur, et le MVP reste-t-il mono-site ?

### Ce qui est déjà en place

| Élément | Où | Valeur actuelle |
|---|---|---|
| Organisation | `0016_seed.sql` | « Cimenterie du Sahel », Burkina Faso, secteur `cement` |
| Site pilote | `0016_seed.sql` | « Usine de Soumbo », code `SMB`, `is_pilot = true` |
| Site secondaire | `0016_seed.sql` | site B, `is_pilot = false` |
| Périmètre par défaut | `app_settings.pilot.site_id` | `22222222-2222-4222-8222-222222222222` |
| Catégories de risques | `0016_seed.sql` | 5 catégories, secteur `cement` |

Le seed est **isolé** : il vit dans son propre fichier et n'est jamais rejoué par `db push`. Le
changer n'est donc pas une migration, c'est un rechargement de seed — ce qui rend cette décision
peu coûteuse, mais aussi **définitivement réversible** tant que l'instance n'est pas en production.

À noter : `is_pilot` et `pilot.site_id` sont transportés jusqu'à l'interface mais **ne pilotent
aucune logique**. Le « site pilote » est aujourd'hui une convention documentaire, pas un
paramètre qui change un comportement.

### Les options

| Option | Ce qui change | Coût |
|---|---|---|
| **(a) Garder Soumbo / cimenterie** | rien | **nul** |
| (b) Autre site, même secteur | 2 lignes du seed (organisation, site) + rechargement du seed sur l'instance | ~15 min |
| (c) Autre site, autre secteur | (b) + réécrire les 5 `risk_categories` du seed | ~30 min |
| (d) Autre secteur + corpus de consignes | (c) + réécrire les 2 consignes du seed | ~1 h |

**À faire dans les deux cas** : recharger le seed et rejouer `npm run db:test` (27 contrôles) puis
la recette navigateur, car les compteurs du tableau de bord et le contenu du référentiel changent.

### Ligne à cocher

- [x] **Site pilote retenu** : Usine de Soumbo (`SMB`)  ·  **Secteur** : cimenterie (`cement`)
- [x] **Le MVP reste mono-site pilote** : oui
- Décisionnel : SAWADOGO Soumaila — Commanditaire  Date : 02/11/2026

---

## A3 — Vérification avant clôture d'une action corrective

**La question.** Qui peut clôturer une action corrective, et sous quelles preuves ?

### Ce qui est déjà en place

C'est l'arbitrage le plus **solidement implémenté** du projet : quatre refus sont garantis par un
trigger de base de données, testés dans `supabase/tests/rls.sql`.

| Règle | Où | Effet |
|---|---|---|
| Passage par `to_verify` obligatoire | trigger `guard_action_transition` (`0013`) | `23514` — « An action must pass through the "to_verify" status before closing » |
| Preuve de clôture obligatoire | idem | `23514` — `closure_evidence_path` + `closure_note` + `verified_by` + `verified_at` exigés |
| **Le responsable ne peut pas vérifier sa propre action** | idem | `23514` — « An action cannot be verified by its own owner » |
| Périmètre du vérificateur | `can_verify_action` (`0010`) + RLS `corrective_actions_update_owner` (`0011`) | rôle `hse_officer` ou `site_director`, sur le site ou dans la même organisation |

### ⚠ Divergence à trancher : l'administrateur peut-il vérifier ?

| Source | Règle |
|---|---|
| La base — `can_verify_action` (`0010`) | **oui** : `public.is_admin() or …` |
| L'interface — `canVerifyAction` (`web/src/lib/rls/permissions.ts`) | **non** : `if (profile.role === 'admin') return false` |

Le PV § 5 annonce « l'administrateur ne peut pas valider une action à la place du HSE
(séparation des responsabilités) ». C'est la position de l'interface, pas celle de la base. **Tant
que l'arbitrage n'est pas tranché, les deux sources de vérité divergent.**

### Les options

| Option | Ce qui change | Coût |
|---|---|---|
| **(a) L'administrateur ne vérifie pas** (position du PV) | aligner la base sur l'interface | migration `0018` modifiant `can_verify_action` + 1 assertion dans `supabase/tests/rls.sql` + mise à jour du PV § 5 |
| (b) L'administrateur peut vérifier (position de la base) | aligner l'interface sur la base | 1 ligne dans `permissions.ts` + 1 test E2E dans CR04 |
| (c) Un rôle « super-vérificateur » | nouvelle règle, nouvelle politique RLS, nouvelle ligne dans l'IHM | ~1 jour + migration + tests |

**Recommandation** : (a). La séparation des responsabilités est l'intérêt même du contrôle, et
c'est la position déjà écrite dans le PV. Le coût est une migration de plus, qui est le prix
normal d'une décision d'architecture — et les migrations sont immuables, donc traçables.

### Ligne à cocher

- [x] **Règle retenue** : l'administrateur ne vérifie pas
- [x] **Vérificateurs habilités par site** (rôles + sites) : `hse_officer` et `site_director`, sur le
  site de l'action ou dans la même organisation
- [x] **Preuve de clôture obligatoire** : oui
- Décisionnel : SAWADOGO Soumaila — Commanditaire  Date : 02/11/2026

> **Divergence close le 02/11/2026** — migration `0021`. `can_verify_action` ne reconnaît plus
> l'administrateur, et le trigger `guard_action_transition` refuse toute clôture dont l'acteur
> n'est pas un vérificateur habilité. Ce second point est nécessaire parce que l'application
> n'écrit pas via `verify_and_close_action` : elle écrit directement dans `corrective_actions`,
> et le trigger est donc le seul point de passage réel. Test de non-régression : T22.

---

## A6 — Corpus de consignes de sécurité validé

**La question.** Qui valide une consigne, sur quel périmètre, et à quelle périodicité de révision ?

### Ce qui est déjà en place

| Règle | Où | Effet |
|---|---|---|
| Seules les consignes validées sont lisibles par un salarié | RLS `safety_documents_select_validated` (`0011`) | `status = 'validated' or is_hse() or is_admin()` |
| Idem pour les versions | RLS `document_versions_select_scoped` (`0011`) | même condition |
| Incrément de version à chaque validation | trigger `document_version_bump` (`0013`) | `current_version` progresse |
| Écriture réservée au HSE / direction / admin | RLS `safety_documents_write_manage` (`0011`) | `is_hse() or is_admin()` |

Le filtre est porté par la **base**, pas par l'interface : `listSafetyDocuments` ne filtre rien
lui-même, il fait confiance à la RLS. C'est le bon sens.

**Ce qui n'existe pas** : `review_due_at` est stocké et affiché (« Review due … » dans la fiche
consigne), mais **aucun mécanisme ne signale** une consigne arrivée à échéance. La périodicité
serait donc un engagement sans contrôle.

### Les options

| Option | Ce qui change | Coût |
|---|---|---|
| **(a) Révision périodique affichée seulement** (état actuel) | rien | **nul**, mais l'échéance n'alerte personne |
| (b) Alerte automatique à l'échéance | trigger ou vue de contrôle + affichage dans l'espace HSE | migration `0018` + 1 écran + 1 test E2E |
| (c) Validation par un référent unique désigné | colonne ou paramètre `app_settings` désignant le référent | migration `0018` + adaptation de la règle d'écriture |

**À trancher aussi** : le périmètre du corpus (secteur, site, ou les deux). Le schéma permet les
deux (`sector` + `scope_text`), mais **rien n'impose** aujourd'hui qu'une consigne soit rattachée à
un site — c'est le référent qui devra l'assurer.

### Ligne à cocher

- [x] **Référent habilité à valider** : le HSE du site pilote (`hse_officer`)
- [x] **Périmètre du corpus** : site
- [x] **Périodicité de révision** : annuelle  ·  alerte à l'échéance : non
- Décisionnel : SAWADOGO Soumaila — Commanditaire  Date : 02/11/2026

---

## A7 — Rôle de l'IA

**La question.** L'assistant reste-t-il consultatif, et sur quel mode tourne-t-il au pilote ?

### Ce qui est déjà en place

| Garde-fou | Où | Effet |
|---|---|---|
| Aucune application automatique | trigger `ai_proposal_review_guard` (`0013`) | `23514` — « An AI proposal can only be applied after a human validation » |
| Toute décision porte un relecteur | idem | `23514` — « Reviewing an AI proposal requires a reviewer » |
| Périmètre de consultation | RLS `ai_proposals_select_scoped` (`0011`) | demandeur, ou périmètre du site, ou admin |
| Mode par défaut | `app_settings.assistant.mode` | `rules` (repli local, sans fournisseur) |

CR06 et CR07 vérifient ce comportement : une proposition reste en attente de décision humaine,
et **aucune** proposition n'est faite sur un danger critique.

### Le point à savoir avant de trancher

Le mode `live` suppose un fournisseur d'IA **et** l'Edge Function `propose-classification`.
**Cette Edge Function n'existe pas dans le dépôt** : `supabase/functions/` est absent, comme les
sept autres fonctions décrites au § 2.7 du runbook. L'application n'en dépend pas — elle écrit
directement dans `ai_proposals` via PostgREST — mais le mode `live` n'est donc **pas**
atteignable en l'état.

> Ce point vaut aussi pour les 7 autres fonctions (`dispatch-outbox`, `send-email`, `send-sms`,
> `lookup-instruction`, `invite-user`, `export-report`, `escalate-critical`). Elles sont
> **spécifiées mais non implémentées**. Conséquence concrète : les e-mails et SMS restent en
> file d'attente (mode `mock`, qui est le défaut du seed), l'export CSV se fait côté navigateur,
> et l'invitation de compte se fait par le back-office — pas par la fonction prévue.

### Les options

| Option | Ce qui change | Coût |
|---|---|---|
| **(a) `rules` au pilote, consultatif** (état actuel) | rien | **nul** |
| (b) `live` avec un fournisseur | implémenter `propose-classification` + le contrat + le test | plusieurs jours — **hors périmètre du pilote** |
| (c) Autoriser l'application automatique par un rôle | **retirer** le trigger `ai_proposal_review_guard` | migration `0018` — **recul de sécurité explicite**, à ne pas faire sans arbitrage explicite |

### Ligne à cocher

- [x] **Mode au pilote** : `rules`
- [x] **L'IA ne valide jamais seule** une catégorie : oui
- [x] **Périmètre des cas où l'assistant est proposé** : classification d'un signalement, hors
  danger critique (CR06 et CR07)
- Décisionnel : SAWADOGO Soumaila — Commanditaire  Date : 02/11/2026

---

## A10 — Modalités de stockage, de sauvegarde et d'hébergement

**La question.** Où l'application est-elle hébergée, et qui garantit les sauvegardes ?

### Ce qui est déjà en place

**Rien dans le code** : c'est le seul arbitrage purement d'exploitation. La proposition actuelle
est décrite au § 9 du document de déploiement (`docs/DEPLOIEMENT.md`), et elle est explicitement
présentée comme une proposition.

| Sujet | Position proposée | À confirmer |
|---|---|---|
| Hébergement base | Supabase Cloud, région la plus proche des utilisateurs | région exacte |
| Sauvegarde | quotidienne automatique + export hebdomadaire hors site | durée de conservation |
| Stockage secondaire | hors site | localisation |
| Exploitation | — | coût, responsable nommé |
| Test de restauration | trimestriel | **qui le fait, et à quelle date** |

### Les options

| Option | Ce qui change | Coût |
|---|---|---|
| **(a) Valider la proposition du § 9** | rien | **nul** côté code |
| (b) Modifier la région / la rétention | rien côté code | décision d'exploitation |
| (c) Ajouter un test de restauration automatisé | script de restauration + planification | ~1 jour |

**Sans responsable nommé**, le test de restauration trimestriel n'existe pas : c'est la seule
ligne de cette fiche qui ne peut pas se fermer par une décision de code.

### Ligne à cocher

- [x] **Région d'hébergement** : Supabase Cloud — Europe (Paris), région `eu-west-3`, vérifiée sur
  l'instance
- [x] **Sauvegarde** : quotidienne automatique + export hebdomadaire hors site — proposition § 9
  validée
- [ ] **Durée de conservation des sauvegardes** : à fixer par le commanditaire — non bloquant pour
  le pilote
- [ ] **Responsable de l'exploitation** : à nommer par le commanditaire — non bloquant pour le
  pilote
- [ ] **Responsable du test de restauration** : à nommer par le commanditaire — non bloquant pour
  le pilote
- Décisionnel : SAWADOGO Soumaila — Commanditaire  Date : 02/11/2026

> Les trois lignes non cochées ne peuvent pas se fermer par une décision de code : elles demandent
> un nom et une durée. La fiche le dit elle-même — « sans responsable nommé, le test de restauration
> trimestriel n'existe pas ». L'arbitrage (option (a), la proposition est validée) est clos ; ces
> trois paramètres relèvent de l'exploitation, pas de la recette.

---

## Récapitulatif

| # | Arbitrage | Défaut en place | Coût pour le garder | Coût pour le changer | Décision retenue (02/11/2026) |
|---|---|---|---|---|---|
| A1 | Site pilote | Soumbo / cimenterie | nul | 15 min à 1 h (seed) | **Gardé** — Soumbo, mono-site |
| A3 | Vérification des clôtures | `to_verify` + preuve + vérificateur ≠ responsable | 1 migration | 1 ligne d'IHM | **Gardé** — l'administrateur ne vérifie pas (migration `0021`) |
| A6 | Corpus de consignes | seul le `validated` est lisible | nul | 1 migration + 1 écran (alerte d'échéance) | **Gardé** — HSE du site, revue annuelle, sans alerte |
| A7 | Rôle de l'IA | consultatif, `rules` | nul | plusieurs jours (`live`) — hors pilote | **Gardé** — `rules`, l'IA ne valide jamais seule |
| A10 | Hébergement et sauvegardes | proposition du § 9 | nul | décision d'exploitation | **Gardé** — Supabase Cloud `eu-west-3`, sauvegarde quotidienne + export hebdomadaire |

**Coût réel de la validation : une migration.** Quatre arbitrages n'ont demandé aucun changement
de code ; A3 en a demandé un, parce que la base et l'interface divergeaient sur la question de
l'administrateur. C'est le prix normal d'une décision d'architecture — et les migrations sont
immuables, donc traçables.

---

*Les cinq arbitrages sont tranchés et signés le 02/11/2026 : les lignes ci-dessus portent la
décision, le nom du décisionnel et la date. Une seule action technique a été nécessaire — la
migration `0021`, qui aligne la base sur l'arbitrage A3 ; elle est rejouée dans les 27 contrôles SQL
(`npm run db:test`). Restent au § 7 du PV de recette : les habilitations nommées avec leur double
facteur, la confirmation du hors-périmètre, et la signature.*
