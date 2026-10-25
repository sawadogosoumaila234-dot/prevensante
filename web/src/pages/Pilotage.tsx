/** Page Pilotage & rapports — indicateurs agrégés par site, atelier, type de risque et période. */

import { useState } from 'react';
import { Alert, Barres, Card, Chip, Filtres, Histogramme, Stat } from '../components/ui';
import { CATEGORIES, MOIS } from '../data/demo';
import { VARIANTE_STATUT } from '../lib/format';

type Periode = '30j' | '90j' | 'annee' | 'tous';

const OPTIONS_PERIODE: { cle: Periode; libelle: string }[] = [
  { cle: '30j', libelle: '30 jours' },
  { cle: '90j', libelle: '90 jours' },
  { cle: 'annee', libelle: 'Cette année' },
  { cle: 'tous', libelle: 'Tous les sites' },
];

const SITES_CLOTURE = [
  { nom: 'Mine de Poura', taux: 82 },
  { nom: 'Cimenterie Kossodo', taux: 74 },
  { nom: 'Usine agro', taux: 68 },
  { nom: 'Carrière de Bobo', taux: 61 },
  { nom: 'Entrepôt Ouaga', taux: 57 },
];

const DANGERS_RECURRENTS = [
  {
    categorie: 'Chute d\'objet / éboulement',
    sites: 3,
    occurrences: 11,
    action: 'Revue du plan de déblaiement',
    statut: 'en_cours',
    libelle: 'En cours',
  },
  {
    categorie: 'Glissade / sol souillé',
    sites: 3,
    occurrences: 5,
    action: 'Formation EPI antidérapant',
    statut: 'a_verifier',
    libelle: 'À vérifier',
  },
  {
    categorie: 'Absence de consignation',
    sites: 2,
    occurrences: 4,
    action: 'Procédure LOTO — convoyeur 2',
    statut: 'a_faire',
    libelle: 'À faire',
  },
  {
    categorie: 'Contrôle périodique dépassé',
    sites: 2,
    occurrences: 4,
    action: 'Contrôle engin de levage n°4',
    statut: 'late',
    libelle: 'En retard',
  },
];

export default function Pilotage() {
  const [periode, setPeriode] = useState<Periode>('30j');

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Pilotage &amp; rapports</h1>
          <div className="sub">
            Indicateurs par site, atelier, type de risque et période · F07
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn secondary sm">
            ⬇︎ Export PDF
          </button>
          <button type="button" className="btn yellow sm">
            ⬇︎ Export CSV
          </button>
        </div>
      </div>

      <Filtres options={OPTIONS_PERIODE} valeur={periode} onChange={(c) => setPeriode(c as Periode)} />

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <Stat
          variante="total"
          label="Total événements"
          valeur={48}
          tendance="sur la période"
        />
        <Stat
          variante="closed"
          label="Taux de clôture"
          valeur="71 %"
          tendance="▲ 6 pts vs période précédente"
          trendClass="up"
        />
        <Stat
          variante="info"
          label="Délai moyen de prise en charge"
          valeur="4,2 j"
          tendance="objectif : 3 j"
        />
        <Stat
          variante="ai"
          label="Dangers récurrents identifiés"
          valeur={5}
          tendance="sur 3 sites"
        />
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card titre="Évolution mensuelle des signalements" sousTitre="2026 — toutes catégories confondues">
          <Histogramme donnees={MOIS} />
        </Card>
        <Card titre="Répartition par catégorie" sousTitre="Effectifs sur la période">
          <Barres
            donnees={CATEGORIES.map((c) => ({
              label: c.label,
              valeur: c.valeur,
              couleur: c.couleur,
            }))}
          />
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card titre="Comparaison des sites" sousTitre="Taux de clôture des actions correctives">
          <div className="bars">
            {SITES_CLOTURE.map((s) => (
              <div className="bar-row" key={s.nom}>
                <span className="lb">{s.nom}</span>
                <span className="track">
                  <i style={{ width: `${s.taux}%` }} />
                </span>
                <span className="vv">{s.taux} %</span>
              </div>
            ))}
          </div>
        </Card>

        <Card titre="Accidents et heures travaillées" sousTitre="Taux d'accidents — données de reliability limitée">
          <div className="grid grid-2" style={{ gap: 14 }}>
            <div className="stat" style={{ boxShadow: 'none' }}>
              <div className="label">Taux d'accidents (TF)</div>
              <div className="value">1,8</div>
              <div className="trend">pour 1 000 000 h travaillées</div>
            </div>
            <div className="stat" style={{ boxShadow: 'none' }}>
              <div className="label">Heures travaillées</div>
              <div className="value">184k</div>
              <div className="trend">données partielles</div>
            </div>
          </div>
          <Alert variante="warn" emoji="📖">
            Les résultats sont interprétés avec prudence : une hausse des signalements peut
            traduire une amélioration de la remontée des dangers, et non une dégradation de la
            sécurité.
          </Alert>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card titre="Dangers récurrents" sousTitre="Catégories qui reviennent sur au moins 3 sites">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Sites concernés</th>
                  <th>Occurrences</th>
                  <th>Action corrective en cours</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {DANGERS_RECURRENTS.map((d) => (
                  <tr key={d.categorie}>
                    <td>
                      <b>{d.categorie}</b>
                    </td>
                    <td>{d.sites}</td>
                    <td>{d.occurrences}</td>
                    <td>{d.action}</td>
                    <td>
                      <Chip variante={VARIANTE_STATUT[d.statut] ?? 'todo'}>{d.libelle}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}