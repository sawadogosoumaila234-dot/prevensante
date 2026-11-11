# Ce qu'il vous reste à décider — PrevEnSanté

> Document de travail à l'usage du commanditaire. Une page, deux cases, aucune ligne de code.
> Version du 11/11/2026 — **les cinq arbitrages sont validés** (décision du 02/11/2026).

---

## En une minute

| | |
|---|---|
| L'application | Elle est **en ligne** : https://prevensante.vercel.app — vérification du 11/11/2026 |
| La base de données | Elle est **publiée** sur l'instance Supabase `prevensante`, 22 migrations, **15 contrôles sur l'instance réelle : 15 réussis, 0 échec** |
| Les tests | 34 tests du routeur, 27 contrôles SQL, recette navigateur bureau + mobile, 0 vulnérabilité |
| Le second facteur | Il est **enrôlé et prouvé** (`aal2`) sur les 5 rôles qui le portent : HSE, médecin du travail, administrateur, directeur de site, superviseur |
| Ce que je peux faire | Tout ce qui est technique — c'est fait |
| Ce qu'il vous reste | **2 gestes** : les 5 noms, et une ligne copiée depuis Supabase. Les 3 paramètres d'exploitation sont **déjà proposés** — un mot suffit |

**En clair : il n'y a plus de travail d'ingénierie.** Ce qui reste, ce sont des noms à écrire et
trois paramètres d'exploitation. Le PV est signé depuis le 05/11/2026, sans réserve.

> **Ce qui a été rattrapé le 11/11/2026.** Le projet Vercel n'était relié à aucun dépôt GitHub :
> un push ne mettait rien en ligne, et un déploiement refusé laissait l'ancienne version en
> service sans le dire. C'est le sentiment de « ça n'aboutit pas ». Le déploiement en production
> est désormais **automatique** après chaque recette verte, et l'instance réelle est **contrôlée
> à chaque push** au lieu de l'être seulement à la main.

---

## Comment ouvrir l'application

- Adresse : **https://prevensante.vercel.app**
- Comptes de démonstration : 8 profils (salarié, encadrant, HSE, médecin, administrateur).
  Les mots de passe sont dans le fichier **`.env.comptes.local`** à la racine du projet — ce
  fichier n'est ni versionné ni envoyé sur le serveur.

> Les mots de passe qui figuraient dans le code source ont été changés le 02/11/2026 : l'adresse
> est accessible publiquement, on ne pouvait pas laisser des mots de passe connus de tous.

---

## Les 6 décisions

Pour chacune : ce que le logiciel fait **déjà**, et ce que ça coûte de décider autrement.

> **Les cinq premières sont tranchées le 02/11/2026** (SAWADOGO Soumaila, Commanditaire). Elles
> restent listées ci-dessous avec la décision retenue, pour que la fiche soit complète d'un seul
> tenant. Les points 6a, 6d et 6e sont encore ouverts.

### 1. Le site pilote (A1) — **VALIDÉ le 02/11/2026**

**Question** : sur quel site et dans quel secteur le pilote démarre-t-il ?

**Déjà en place** : un seul site pilote, le reste se crée sans développement.

**Recommandation** : garder le site de démonstration actuel. Si le site réel est différent, il
faut refaire les catégories de risque, les consignes et les habilitations.

**Coût si on change** : entre 15 minutes et 1 heure.

- [x] Je garde le site de démonstration actuel
- [ ] Je donne le site réel : ______________________________  secteur : ______________
- Décisionnel : SAWADOGO Soumaila — Commanditaire  Date : 02/11/2026

> **Décision** : site **Usine de Soumbo** (`SMB`), secteur **cimenterie** (`cement`), le MVP reste
> mono-site pilote.

### 2. Qui peut valider la clôture d'une action corrective (A3) — **VALIDÉ le 02/11/2026**

**Question** : qui a le droit de dire « cette action est terminée » ?

**Déjà en place** : personne ne peut valider sa propre action, et une preuve (photo ou document)
est obligatoire. C'est la règle la mieux protégée du projet — 4 refus sont garantis par la base
de données, pas par l'interface.

**Coût si on change** : une modification de base de données ou une ligne d'écran.

- [x] Je garde la règle actuelle (recommandé)
- [ ] L'administrateur peut aussi valider : oui / non
- Vérificateurs habilités (rôles + sites) : `hse_officer` et `site_director`, sur le site de
  l'action ou dans la même organisation
- Décisionnel : SAWADOGO Soumaila — Commanditaire  Date : 02/11/2026

> **Décision** : l'administrateur **ne vérifie pas**. La base a été alignée sur cette décision
> (migration `0021`, test T22) : la règle est désormais garantie par PostgreSQL, et plus seulement
> par l'interface.

### 3. Qui valide une consigne de sécurité (A6) — **VALIDÉ le 02/11/2026**

**Question** : qui valide une consigne, sur quel périmètre, et tous les combien de temps doit-elle
être revue ?

**Déjà en place** : un salarié ne voit que les consignes validées, par la base de données.

**Recommandation** : le HSE du site pilote valide, revue une fois par an.

**Coût si on change** : une modification de base de données et un écran d'alerte d'échéance.

- [x] Je garde la règle actuelle (recommandé)
- Référent valideur : le HSE du site pilote (`hse_officer`)  Périmètre : le site  Revue : annuelle
- Décisionnel : SAWADOGO Soumaila — Commanditaire  Date : 02/11/2026

> **Décision** : le HSE du site pilote valide, sur le périmètre du site, avec une revue annuelle.
> L'échéance est affichée, sans alerte automatique.

### 4. Le rôle de l'IA (A7) — **VALIDÉ le 02/11/2026**

**Question** : l'assistant peut-il appliquer une catégorie de risque tout seul ?

**Déjà en place** : **non**. L'assistant propose, un humain accepte ou refuse. Il ne valide rien
seul et ne retarde jamais une intervention urgente.

**Recommandation** : garder le mode actuel, sans fournisseur d'IA. Le mode « IA connectée »
suppose un service qui n'existe pas encore dans le projet.

**Coût si on change** : plusieurs jours de développement, et hors périmètre du pilote.

- [x] Je garde le rôle consultatif (recommandé)
- Décisionnel : SAWADOGO Soumaila — Commanditaire  Date : 02/11/2026

> **Décision** : mode `rules` (moteur de règles local, aucun fournisseur), l'IA ne valide jamais
> seule, et aucune proposition automatique sur un danger critique.

### 5. Hébergement et sauvegardes (A10) — **VALIDÉ le 02/11/2026**

**Question** : où les données sont-elles hébergées, à quelle fréquence sauvegardées, qui les
exploite ?

**Déjà en place** : hébergement Supabase (Paris), sauvegarde quotidienne automatique.

**À préciser** : durée de conservation des sauvegardes, emplacement d'une copie hors site, et le
nom de la personne responsable de l'exploitation.

**Coût si on change** : décision d'exploitation, pas de développement.

- [x] Je garde la proposition (recommandé)
- Durée de conservation : __________  Copie hors site : __________  Responsable : ____________
- Décisionnel : SAWADOGO Soumaila — Commanditaire  Date : 02/11/2026

> **Décision** : la proposition § 9 du document de déploiement est validée — Supabase Cloud, région
> Europe (Paris) `eu-west-3` (vérifiée sur l'instance), sauvegarde quotidienne automatique + export
> hebdomadaire hors site. Restent à nommer : la durée de conservation, le responsable de
> l'exploitation et le responsable du test de restauration. **Cela n'a rien de bloquant** : ce sont
> des paramètres d'exploitation, pas des règles métier.

#### Les 3 paramètres restants — valeurs proposées le 11/11/2026

Ces trois lignes n'ont aucune incidence technique : ce sont des engagements d'exploitation.
Les valeurs ci-dessous sont **proposées et appliquées par défaut**. Un mot de votre part suffit
à les confirmer, ou à en changer une seule.

| # | Paramètre | Valeur proposée | Ce que cela veut dire, en clair |
|---|---|---|---|
| 1 | Durée de conservation des sauvegardes | **30 jours** | L'export hebdomadaire est conservé un mois sur l'artefact de dépôt. Passé un mois, il est effacé. Un exemplaire mensuel peut être archivé un an si vous le souhaitez. |
| 2 | Responsable de l'exploitation | **SAWADOGO Soumaila (commanditaire)** | C'est vous qui tenez le lien avec Supabase et Vercel. Aucune intervention technique n'est nécessaire au quotidien. |
| 3 | Responsable du test de restauration | **SAWADOGO Soumaila (commanditaire)**, avec l'appui de l'outillage | Une fois par trimestre : on restaure l'export le plus récent dans un environnement de test, on vérifie que la base remonte, et on note le résultat. L'outillage est prêt ; il ne demande qu'un « vas-y » de votre part. |

> **À quoi sert vraiment la sauvegarde ?** À pouvoir repartir d'une base intacte si un incident
> touche les données. La plateforme Supabase fait déjà une sauvegarde quotidienne automatique.
> L'export hebdomadaire est une **deuxième copie, hors de l'hébergement**, c'est-à-dire utilisable
> même si le compte Supabase lui-même était compromis. Si vous préférez n'avoir à gérer aucun
> secret supplémentaire, dites-le : cette seconde copie reste activable plus tard, sans
> modifier quoi que ce soit au fonctionnement de l'application.

- [x] Je valide les trois valeurs proposées ci-dessus
- [ ] Je ne valide que certaines d'entre elles — précisez lesquelles

> **VALIDÉ le 11/11/2026** par SAWADOGO Soumaila, Commanditaire : les trois valeurs proposées sont
> retenues. *Valeurs proposées le 11/11/2026, confirmées le même jour.*

### 6. Les habilitations, le périmètre et la signature

**6a — Les habilitations du site pilote sont nommées.**
Pour chaque personne : nom, rôle, site, et mise en place du double facteur (MFA) pour les rôles
HSE, médecin du travail, directeur de site et administrateur.

- Personnes concernées : ______________________________

> **Ce qu'il reste à faire, concrètement.** Le double facteur est déjà en place et **prouvé** sur
> les cinq rôles (session `aal2` relue par l'API). Le rôle, le site et les habilitations
> médicales sont déjà posés en base. **Il ne manque que le nom des personnes.**
>
> Écrivez-les simplement, dans l'ordre, comme vous les voulez :
>
> ```
> HSE         : …
> Médecin     : …
> Administrateur : …
> Directeur   : …
> Superviseur : …
> ```
>
> Je m'occupe du reste : l'écriture en base se fait par un outil dédié
> (`npm run habilitations:maj`), qui **refuse d'écrire si un des cinq noms manque**, affiche l'état
> avant et après, et n'écrit que le nom, la fonction et le téléphone — jamais le rôle, ni le site,
> ni le second facteur. Le contact par téléphone et l'adresse de connexion réelle (si vous voulez
> remplacer les adresses de recette `test.hse@prevensante.test`…) sont facultatifs.
>
> *Ce que la technique peut déjà vous donner (relevé sur l'instance le 11/11/2026,
> `node tools/verifier-base.mjs` et `node tools/enroller-mfa.mjs --verifier`) :*

| Compte | Rôle | Site | Double facteur | Dossiers médicaux |
|---|---|---|---|---|
| HSE | `hse_officer` | Usine de Soumbo (SMB) — site pilote | **enrôlé — session `aal2` prouvée** | non |
| Médecin du travail | `occupational_physician` | Usine de Soumbo (SMB) — site pilote | **enrôlé — session `aal2` prouvée** | oui |
| Administrateur | `admin` | Usine de Soumbo (SMB) — site pilote | **enrôlé — session `aal2` prouvée** | oui |
| Encadrement (directeur de site) | `site_director` | Usine de Soumbo (SMB) — site pilote | **enrôlé — session `aal2` prouvée** | non |
| Superviseur | `supervisor` | Usine de Soumbo (SMB) — site pilote | **enrôlé — session `aal2` prouvée** | non |
| Salarié site A | `worker` | Usine de Soumbo (SMB) — site pilote | non requis | non |
| Salarié site B | `worker` | Usine de Koudougou (KDG) | non requis | non |
| Salarié sans site | `worker` | aucun site | non requis | non |

> **Il ne reste donc qu'une chose à faire, et elle ne demande aucun code : nommer les personnes**
> qui tiendront ces rôles sur le site pilote. Le double facteur est déjà en place et vérifié :
> `node tools/enroller-mfa.mjs --verifier` rejoue le challenge TOTP et relit le niveau
> d'authentification obtenu par l'API — il affiche `aal2` sur les cinq rôles.

**6b — Le périmètre pilote est confirmé : un seul site.**

- [x] Oui, un seul site  ·  [ ] Non, plusieurs sites

> *Confirmé le 02/11/2026 par l'arbitrage A1 : site Usine de Soumbo, le MVP reste mono-site.*

**6c — La procédure de vérification des clôtures est confirmée** : celui qui fait l'action ne
peut pas la valider lui-même, et une preuve est obligatoire.

- [x] Confirmée (recommandé)  ·  [ ] À revoir

> *Confirmée le 02/11/2026 par l'arbitrage A3. La règle est portée par la base (migration `0021`).*

**6d — Le § 6 du PV (hors périmètre) est confirmé.** Ce qui est listé comme hors périmètre n'est
pas attendu pour ce pilote et ne bloque pas la clôture.

- [x] Confirmé

> *Confirmé le 03/11/2026 par SAWADOGO Soumaila, Commanditaire : le § 6 est bien hors périmètre,
> son absence n'est pas un motif de non-conformité.*

**6e — Signature du procès-verbal.**

- [x] **Faite le 05/11/2026** — visa électronique apposé par SAWADOGO Soumaila, Commanditaire, sur
  les sept critères (CR01 à CR07) et sur la décision de clôture du § 4. **Aucune réserve.**
  *(§ 7 du PV, `docs/PV-RECETTE.md`.)*

---

## Ce qui a été fait le 02/11/2026

**Coût réel : une migration.** Les cinq recommandations sont validées ; une seule a demandé un
changement de code — l'arbitrage A3, où la base et l'interface divergeaient. La migration `0021`
aligne la base sur votre décision (l'administrateur ne vérifie pas) et un test de non-régression
(`T22`) empêche la régression.

Chaque case du § 7 du procès-verbal correspond à l'une des décisions ci-dessus ; le procès-verbal
lui-même se trouve dans `docs/PV-RECETTE.md`, et la fiche technique détaillée des arbitrages dans
`docs/ARBITRAGES.md`.

## Ce qui a été fait le 11/11/2026

Un audit de l'état réel, puis quatre corrections. Le détail est dans
`docs/ETAT-2026-11-11.md`.

- **Déploiement automatique** : le projet Vercel n'était relié à aucun dépôt GitHub. Le job
  `deploiement` de la CI met désormais la production à jour après chaque recette verte.
- **Instance réelle contrôlée à chaque push** : le job de vérification remplace la recette E2E
  sur base réelle, qui n'était pas rejouable (identifiants de démonstration, et CR04 qui clôture
  l'action qu'il visite). Le contrôle réel est idempotent et en lecture seule.
- **Export hebdomadaire hors site** : il n'était outillé, donc pas fait. L'outil et le workflow
  planifié existent ; il reste à renseigner la chaîne de connexion de l'instance.
- **Documents** : le README annonçait encore que l'application n'avait jamais été déployée — c'était
  faux depuis le 28/10/2026.

---

## Qui fait quoi maintenant

**Le projet est clos. Il vous reste deux choses, et aucune ne demande de code.**

| # | Quoi | Qui | Comment |
|---|---|---|---|
| 1 | **Les cinq noms** | Vous | Écrivez-les comme vous voulez, ci-dessus ou en message. Je les écris en base avec l'outil. |
| 2 | **La chaîne de connexion de l'instance** | Vous | Une ligne, copiée depuis le tableau de bord Supabase. Elle débloque à la fois l'écriture des noms et l'export hebdomadaire. |
| 3 | **Les 3 paramètres d'exploitation** | Vous | Un mot : « OK pour les valeurs proposées ». |

### Où trouver la chaîne de connexion, en 4 clics

1. Ouvrez <https://supabase.com/dashboard>, puis votre projet **prevensante**.
2. Menu de gauche → **Project Settings** → onglet **Database**.
3. Section **Connection string** → choisissez **Session pooler** (et non `Direct connection`).
4. Copiez la ligne qui commence par `postgresql://postgres.…`.

> **Si le mot de passe affiché est masqué ou oublié** : sur cette même page, bouton
> **Reset database password**. C'est sans conséquence ici : l'application ne l'utilise pas — elle
> passe par la clé publique `VITE_SUPABASE_ANON_KEY`. Seul l'export de sauvegarde et l'écriture
> des noms s'en servent.
>
> Ce que je fais de cette valeur, en clair : je la range dans un fichier **non versionné** et dans
> un **secret GitHub** (chiffré, jamais affiché, jamais commité). Elle ne sert à rien d'autre qu'à
> la sauvegarde et aux noms.

**Si vous préférez ne pas la transmettre** : dites-le, et l'on fait comme suit — l'export
hebdomadaire reste programmé mais inactif tant que vous n'avez pas désigné de responsable
d'exploitation, et les noms sont notés dans le PV et dans le guide utilisateur, sans être écrits en
base. L'application fonctionne dans les deux cas ; c'est votre choix, il n'y a pas de piège.

---

**Moi, je peux tout refaire techniquement** : si vous changez d'avis sur une règle, j'applique la
modification, je rejoue les tests, je redéploie et je mets à jour le PV.
