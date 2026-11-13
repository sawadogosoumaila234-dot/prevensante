# Publier PrevEnSanté sur opensource.bf

> Ce document est la fiche de publication du projet. Il dit quoi copier, où, et ce qu'il ne
> faut pas laisser sortir. Il ne contient aucun secret.
>
> Rappel du camp (récapitulatif Jour 4, phase 3) : « Chaque projet devient un dépôt public sur
> opensource.bf, avec son auteur au crédit et sa démo en ligne. »

---

## 1. Les trois entrées à remplir dans le catalogue

| Entrée | Valeur à copier |
|---|---|
| **Lien de démonstration** | `https://prevensante-demo.vercel.app` |
| **Accès au code source** | `https://github.com/sawadogosoumaila234-dot/prevensante` |
| **Profil du porteur** | La fiche du porteur sur opensource.bf, avec le nom **SAWADOGO Soumaila** (et Emmanuel Sawadogo), et un lien vers le compte GitHub `sawadogosoumaila234-dot` |

> La démo publique est l'instance **sans compte** : elle tourne sur le jeu de données
> fictif embarqué dans l'application. C'est celle qu'il faut publier — l'instance de recette
> (`prevensante.vercel.app`) demande un compte et affiche les noms du site pilote.

---

## 2. Ce qui est prêt

- [x] **Démo en ligne sans installation** — huit profils au choix, second facteur `123456`
- [x] **Dépôt public** avec **licence MIT** (`LICENSE`) et README complet
- [x] **README standardisé** : pile, architecture, démarrage, scripts, tests, CI, secrets, déploiement
- [x] **Intégration continue verte** : base Supabase réelle contrôlée, typage/SQL/recette E2E, déploiement en production
- [x] **Sauvegarde hebdomadaire** hors du site d'hébergement, avec **test de restauration automatique**
- [x] **Documentation** : PRD, PV de recette, guide utilisateur, runbook d'exploitation, notes d'état
- [x] **Captures d'écran** (données fictives) : `docs/ui_dashboard.png`, `docs/ui_signalements.png`,
      `docs/ui_pilotage.png`, `docs/ui_actions.png`

## 3. Ce qui reste — deux gestes, tous deux les vôtres

- [ ] **Créer votre fiche auteur sur opensource.bf** (nom, photo ou avatar, lien GitHub).
      Le catalogue distingue une contribution anonyme d'un projet porté : c'est votre nom
      qui doit y figurer.
- [ ] **Déposer la fiche** dans le catalogue avec les trois liens ci-dessus.

Ces deux gestes demandent votre identité : ils ne peuvent pas être faits à votre place.

---

## 4. Démo de trois minutes — le déroulé

À dérouler sur la démo publique, en partant du profil « HSE officer » :

| Temps | Geste | Ce qu'on montre |
|---|---|---|
| 0:00 | Ouvrir `prevensante-demo.vercel.app`, cliquer « HSE officer » | Connexion sans compte ni installation |
| 0:20 | Tableau de bord : 24 signalements, 8 en cours, 3 actions en retard, 12 clôturés | La mesure en temps réel du risque |
| 1:00 | Onglet **Signalements** → ouvrir « Sol huileux près du concasseur » | Une fiche complète : site, zone, gravité, photos, statut |
| 1:40 | Onglet **Actions correctives** → « Contrôle périodique de l'engin de levage n°4 » | Le suivi jusqu'à la clôture, avec échéance et responsable |
| 2:20 | « Signaler un danger » → décrire un risque | Le parcours signalement, en moins d'une minute |
| 2:45 | Onglet **Assistant IA** → poser une question sur une consigne | L'IA consultative : elle propose, elle ne valide jamais |
| 3:00 | Revenir au tableau de bord | La boucle complète : signaler → traiter → clôturer |

---

## 5. Ce qui ne doit pas sortir

- **Aucun secret dans le dépôt.** Vérifié sur l'historique complet avant publication : les
  seules occurrences de chaînes de connexion sont des exemples commentés
  (`postgresql://postgres.<ref>:<mot de passe>@…`). Les seuls fichiers `.env` versionnés sont
  des modèles (`.env.example`, `.env.habilitations.example`) ; les fichiers réels
  (`.env.local`, `.env.comptes.local`, `.env.habilitations.local`) sont ignorés par git.
- **Aucune donnée de santé réelle.** La démo publique tourne sur le jeu de données fictif.
  La base de recette ne contient que des données d'essai.
- **Les secrets de déploiement restent dans les secrets GitHub**, pas dans le dépôt :
  `SUPABASE_DB_URL`, `VERCEL_TOKEN`, `VITE_SUPABASE_ANON_KEY`, mots de passe et secrets TOTP
  des comptes de recette.

---

## 6. Après la publication

Le projet reste vivant : le code est sur GitHub, la CI se déclenche à chaque push, et
l'application reste en ligne. Si une version change, un nouveau push met la production à
jour automatiquement — c'est le rôle du job « Déploiement en production ».

Le point à surveiller est connu et daté : le secret `VERCEL_TOKEN` expire le **13/11/2027**.
La procédure de renouvellement est écrite au runbook (§ I7).
