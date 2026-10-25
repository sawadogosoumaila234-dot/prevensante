/** Liste filtrable des signalements — dangers, incidents et accidents du périmètre. */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Chip,
  ChipCategorie,
  Empty,
  Filtres,
  SignalementItem,
  Stat,
  type FiltreOption,
} from '../components/ui';
import { useFiltreSignalements, useSignalements } from '../hooks/useDonnees';
import { formatDate, LIBELLE_STATUT } from '../lib/format';

type Critere = 'all' | 'danger' | 'incident' | 'accident' | 'prio' | 'open' | 'closed';

const FILTRES: FiltreOption[] = [
  { cle: 'all', libelle: 'Tous (24)' },
  { cle: 'danger', libelle: 'Dangers (14)' },
  { cle: 'incident', libelle: 'Incidents (7)' },
  { cle: 'accident', libelle: 'Accidents (3)' },
  { cle: 'prio', libelle: 'Prioritaires' },
  { cle: 'open', libelle: 'En cours' },
  { cle: 'closed', libelle: 'Clôturés' },
];

export default function Signalements() {
  const { donnees: signalements } = useSignalements();
  const [critere, setCritere] = useState<Critere>('all');
  const liste = useFiltreSignalements(signalements, critere);

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Signalements</h1>
          <div className="sub">
            Tous les événements de votre périmètre · dangers, incidents et accidents
          </div>
        </div>
        <Link className="btn yellow" to="/signaler">
          ⚠️ Nouveau signalement
        </Link>
      </div>

      <div className="grid grid-4">
        <Stat variante="total" label="Total" valeur={24} tendance="sur 30 jours" />
        <Stat variante="info" label="Dangers" valeur={14} tendance="58 % des signalements" />
        <Stat variante="open" label="Incidents" valeur={7} tendance="dont 2 récurrents" />
        <Stat
          variante="late"
          label="Accidents"
          valeur={3}
          tendance="1 arrêt de travail en cours"
          trendClass="down"
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <Filtres options={FILTRES} valeur={critere} onChange={(cle) => setCritere(cle as Critere)} />
      </div>

      <Card>
        {liste.length === 0 ? (
          <Empty emoji="📭">Aucun signalement pour ce filtre.</Empty>
        ) : (
          liste.map((s) => (
            <SignalementItem
              key={s.id}
              type={s.type_evenement}
              titre={s.titre}
              reference={s.reference}
              meta={`${s.site} · ${s.zone} · ${formatDate(s.declare_at)}`}
              description={s.description}
              tags={
                <>
                  <Chip variante={s.statut}>{LIBELLE_STATUT[s.statut]}</Chip>
                  {s.en_retard && <Chip variante="late">En retard</Chip>}
                  {(s.priorite === 'critique' || s.priorite === 'elevee') && (
                    <Chip variante="prio">Prioritaire</Chip>
                  )}
                  <ChipCategorie categorie={s.categorie} />
                </>
              }
            />
          ))
        )}
      </Card>

      <Card titre="Export et rapports" sousTitre="Les rapports tiennent compte du périmètre de chaque responsable">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn secondary sm" type="button">
            ⬇︎ Export CSV — 30 jours
          </button>
          <button className="btn secondary sm" type="button">
            ⬇︎ Export PDF — par site
          </button>
          <button className="btn ghost sm" type="button">
            🖨︎ Imprimer la liste
          </button>
        </div>
      </Card>
    </>
  );
}
