/**
 * Page « Actions correctives » (F04).
 *
 * Affectation, échéances, statuts et vérification de clôture des actions.
 */

import { useState } from 'react';
import { ActionCard, Alert, Card, Chip, Empty, Filtres, Stat } from '../components/ui';
import { useActions, useFiltreActions } from '../hooks/useDonnees';

type Critere = 'all' | 'a_faire' | 'en_cours' | 'a_verifier' | 'cloturee' | 'late';

const OPTIONS_FILTRE: { cle: Critere; libelle: string }[] = [
  { cle: 'all', libelle: 'Toutes (8)' },
  { cle: 'a_faire', libelle: 'À faire' },
  { cle: 'en_cours', libelle: 'En cours' },
  { cle: 'a_verifier', libelle: 'À vérifier' },
  { cle: 'cloturee', libelle: 'Clôturées' },
  { cle: 'late', libelle: 'En retard (3)' },
];

export default function Actions() {
  const { donnees: actions } = useActions();
  const [critere, setCritere] = useState<Critere>('all');
  const filtrees = useFiltreActions(actions, critere);

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Actions correctives</h1>
          <div className="sub">Affectation, échéances, statuts et vérification · F04</div>
        </div>
        <button className="btn yellow">＋ Nouvelle action</button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <Stat variante="total" label="À faire" valeur={3} tendance="dont 2 en retard" />
        <Stat variante="info" label="En cours" valeur={2} tendance="progression moyenne 48 %" />
        <Stat variante="open" label="À vérifier" valeur={2} tendance="en attente de validation" />
        <Stat
          variante="closed"
          label="Clôturées"
          valeur={12}
          tendance="▲ 71 % dans les délais"
          trendClass="up"
        />
      </div>

      <Filtres
        options={OPTIONS_FILTRE}
        valeur={critere}
        onChange={(cle) => setCritere(cle as Critere)}
      />

      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        {filtrees.length === 0 ? (
          <Empty emoji="✅">Aucune action pour ce filtre.</Empty>
        ) : (
          filtrees.map((a) => (
            <ActionCard
              key={a.id}
              titre={a.titre}
              statut={a.statut}
              statutLibelle={a.statut_libelle}
              enRetard={a.en_retard}
              responsable={a.responsable}
              echeance={a.echeance}
              site={a.site}
              reference={a.signalement_ref}
              avancement={a.avancement}
            />
          ))
        )}
      </div>

      <Card titre="Cycle de vie d'une action" sousTitre="Les quatre statuts disponibles et la règle de clôture">
        <div className="grid grid-4" style={{ marginBottom: 14 }}>
          <Chip variante="a_faire">À faire</Chip>
          <Chip variante="en_cours">En cours</Chip>
          <Chip variante="a_verifier">À vérifier</Chip>
          <Chip variante="cloturee">Clôturée</Chip>
        </div>
        <Alert variante="warn" emoji="⚠️" titre="Clôture soumise à vérification">
          Une action ne peut être clôturée que par une personne compétente du site. Les actions en retard
          sont visibles dans le tableau de bord et notifiées au responsable désigné.
        </Alert>
      </Card>
    </>
  );
}
