# PRD — PrevEnSanté

Auteur : SAWADOGO Emmanuel · Prévention des risques professionnels · Burkina Faso

## 1. Contexte

PrevEnSanté est une application de prévention des accidents de travail destinée aux mines, carrières, cimenteries, usines, entreprises du bâtiment et des travaux publics, industries agroalimentaires et métallurgiques, ainsi qu’aux plateformes logistiques.

Elle centralise les dangers, incidents et accidents, puis le suivi des actions correctives. La première version minimale fonctionnelle (MVP) vise un site pilote avant extension multisectorielle. L’intelligence artificielle (IA) assiste la classification et la consultation de consignes validées, sans remplacer les responsables ni les procédures de sécurité.

## 2. Objectifs

- Centraliser les signalements et dossiers d’événements par site et zone.

- Faciliter la prise en charge des risques et suivre les actions jusqu’à leur vérification.

- Identifier les dangers récurrents et éclairer les décisions de prévention.

- Faciliter l’accès aux consignes adaptées aux activités et équipements.

- Suivre les délais de traitement et les clôtures dans les délais ; cibles chiffrées à définir après observation.

## 3. Utilisateurs

| Profil | Besoins et responsabilités |
| --- | --- |
| Travailleur | Saisir un danger, un incident ou un accident ; consulter les consignes. |
| Responsable HSE | Évaluer les événements, attribuer et vérifier les actions ; consulter les indicateurs de son périmètre. |
| Administrateur | Gérer comptes, rôles, sites, zones et catégories de risques. |
| Autres profils du produit cible | Superviseur, maintenance, médecin du travail et directeur : coordination, traitement, accès médical protégé ou consultation. Activation et droits dans le pilote à confirmer. |

HSE : hygiène, sécurité et environnement. Le MVP retient les trois premiers profils ; la matrice détaillée des habilitations reste à confirmer.

## 4. Fonctionnalités

- F01 — Accès et référentiels : l’administrateur gère les comptes, autorisations, sites et zones ; les catégories de risques sont adaptées au secteur. Chaque utilisateur accède uniquement à son périmètre.

- F02 — Signalements et événements : le travailleur renseigne type (danger, incident ou accident), site, zone, date, description et catégorie ; photo et équipement facultatifs. Un identifiant unique est attribué ; le dossier peut être complété et ses modifications sont historisées.

- F03 — Actions correctives : le responsable HSE attribue les actions et échéances ; les statuts sont « à faire », « en cours », « à vérifier » et « clôturée ». Les retards sont visibles ; les modalités de vérification avant clôture restent à confirmer.

- F04 — Pilotage : le responsable HSE consulte événements, priorités et actions en retard, filtrés par site, zone et période. Rapports et notifications figurent dans le produit cible ; leur étendue dans le pilote reste à confirmer.

- F05 — Assistance IA limitée : à partir d’une description, l’IA propose une catégorie et recherche les consignes dans des documents validés. Elle affiche références disponibles et limites ; ses suggestions restent soumises à vérification humaine.

## 5. Hors périmètre

- Analyse automatique des vidéos et connexion aux capteurs industriels : différées après validation du MVP.

- Maintenance prédictive et prédiction statistique des accidents : différées.

- Autorisation autonome d’interventions dangereuses ou déclaration d’un site « sûr » par l’IA : exclues.

- Remplacement des alarmes, arrêts d’urgence, procédures de consignation ou plans d’intervention : exclu.

## 6. Critères de réception

| Référence | Scénario ou condition | Résultat attendu |
| --- | --- | --- |
| CR01 — F01 | Accéder à un site non autorisé. | Accès refusé, sans exposition des données. |
| CR02 — F02 | Saisir un danger complet, puis omettre un champ obligatoire. | Identifiant unique et confirmation dans le premier cas ; erreur explicite dans le second. |
| CR03 — F02 | Créer puis compléter un incident ou accident. | Type conservé ; modifications historisées ; données médicales non exposées aux profils non autorisés. |
| CR04 — F03 | Attribuer une action, fixer une échéance dépassée et changer son statut. | Responsable, échéance et statut enregistrés ; retard visible ; règle de vérification appliquée après validation. |
| CR05 — F04 | Filtrer les données du tableau de bord. | Événements et actions correspondent aux filtres et aux habilitations. |
| CR06 — F05 | Demander une catégorie et une consigne sur un cas couvert par le corpus. | Suggestion révisable ; réponse fondée sur les documents validés, avec références disponibles et limites. |
| CR07 — F02/F05 | Déclarer un danger grave ou immédiat. | Invitation à se mettre en sécurité et à appliquer les procédures du site ; aucun traitement IA imposé avant l’alerte. |

La recette définitive nécessite de valider les habilitations, la vérification des clôtures et le périmètre pilote ; aucun seuil de performance n’est fixé à ce stade.

## 7. Contraintes

- Interface utilisable sur smartphone, tablette et ordinateur, avec formulaires adaptés au terrain. Connexion instable prise en compte ; fonctionnement hors ligne à étudier, non acquis.

- Accès contrôlés, traçabilité et séparation des données médicales et générales de sécurité. Modalités de stockage, sauvegarde et hébergement à définir.

- Corpus de sécurité validé et actualisé par des responsables compétents ; responsables et fréquence de mise à jour à confirmer. L’IA ne doit jamais retarder une intervention urgente.

- Site pilote, budget, calendrier, responsabilités de réalisation et critères de performance à définir. Technologies et intégrations non imposées. Les taux d’accidents nécessitent des heures travaillées fiables ; davantage de signalements ne signifie pas nécessairement davantage d’accidents.

## 8. Livrables

- Application MVP de signalement et de suivi, comprenant tableau de bord et assistance IA limitée.

- Proposition à valider : configuration initiale du pilote, comptes et rôles, catégories et bibliothèque documentaire validée.

- Proposition à valider : guide utilisateur et administrateur, rapport de tests et procès-verbal de recette.

- Remise du code source, formation, hébergement et maintenance : à confirmer contractuellement.
