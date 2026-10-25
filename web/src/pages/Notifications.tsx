import { useState } from 'react';
import { Alert, Card, Empty, Stat } from '../components/ui';
import { useNotifications } from '../hooks/useDonnees';
import { formatDate } from '../lib/format';

export default function Notifications() {
  const { donnees } = useNotifications();
  const [marquees, setMarquees] = useState(false);

  const nonLues = donnees.filter((n) => n.non_lue).length;
  const retards = donnees.filter((n) => n.titre.toLowerCase().includes('retard')).length;

  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Notifications</h1>
          <div className="sub">
            {nonLues} non lues · alertes de retard et confirmations de traitement
          </div>
        </div>
        <button className="btn secondary sm" onClick={() => setMarquees(true)}>
          Tout marquer comme lu
        </button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <Stat variante="total" label="Non lues" valeur={marquees ? 0 : nonLues} tendance="2 alertes de retard" />
        <Stat variante="late" label="Échéances dépassées" valeur={retards} tendance="action requise" />
        <Stat variante="closed" label="Cette semaine" valeur={9} tendance="▲ vs semaine passée" trendClass="up" />
        <Stat variante="info" label="Erreurs d'envoi" valeur={0} tendance="journal de traçabilité" />
      </div>

      <Card titre="Fil d'activité" sousTitre="Chaque notification est traçable dans le journal">
        {donnees.length === 0 ? (
          <Empty emoji="📭">Aucune notification.</Empty>
        ) : (
          donnees.map((n) => (
            <div className="item" key={n.id}>
              <div className={`ic ${n.non_lue && !marquees ? 'incident' : 'neutral'}`}>{n.emoji}</div>
              <div className="body">
                <div className="row1">
                  <span className="title">{n.titre}</span>
                </div>
                <div className="desc">{n.detail}</div>
                <div className="meta">
                  {formatDate(n.quand)}
                  {n.non_lue && !marquees && (
                    <>
                      {' · '}
                      <b style={{ color: 'var(--danger)' }}>non lue</b>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card titre="Règles de notification">
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Alert variante="info" emoji="🔔" titre="Push">
            Signalement prioritaire, action en retard, action clôturée.
          </Alert>
          <Alert variante="ok" emoji="✉️" titre="E-mail">
            Rapport hebdomadaire au directeur de site, récapitulatif des actions en retard.
          </Alert>
        </div>
      </Card>
    </>
  );
}
