import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionCard,
  Alert,
  Barres,
  Card,
  Chip,
  ChipCategorie,
  Histogramme,
  Segments,
  SignalementItem,
  Stat,
} from '../components/ui';
import { CATEGORIES, MOIS, SITES } from '../data/demo';
import { useActions, useFiltreActions, useSignalements } from '../hooks/useDonnees';
import { formatDate, LIBELLE_STATUT } from '../lib/format';

type RoleVue = 'travailleur' | 'responsable_hse' | 'directeur_site' | 'admin';

const ROLES: { cle: RoleVue; libelle: string }[] = [
  { cle: 'travailleur', libelle: 'Travailleur' },
  { cle: 'responsable_hse', libelle: 'Responsable HSE' },
  { cle: 'directeur_site', libelle: 'Directeur de site' },
  { cle: 'admin', libelle: 'Admin' },
];

export default function TableauDeBord() {
  const [role, setRole] = useState<RoleVue>('responsable_hse');

  const { donnees: signalements } = useSignalements();
  const { donnees: actions } = useActions();
  const actionsEnRetard = useFiltreActions(actions, 'late');
  const recents = signalements.slice(0, 3);

  return (
    <>
      <div className="page-head">
        <div className="row">
          <div>
            <h1>Bonjour Soumaïla 👋</h1>
            <div className="sub">
              Mine de Poura — Zone Nord · 25 octobre 2026 · données fictives de démonstration
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link className="btn secondary" to="/pilotage">
              📊 Voir les rapports
            </Link>
            <Link className="btn yellow" to="/signaler">
              ⚠️ Nouveau signalement
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 420, marginBottom: 20 }}>
        <Segments options={ROLES} valeur={role} onChange={setRole} />
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <Stat
          variante="total"
          label="Signalements"
          valeur={24}
          tendance="▲ 12 % vs semaine précédente"
          trendClass="up"
        />
        <Stat variante="open" label="En cours de traitement" valeur={8} tendance="3 cette semaine" />
        <Stat
          variante="late"
          label="Actions en retard"
          valeur={3}
          tendance="⚠ à traiter aujourd'hui"
          trendClass="down"
        />
        <Stat variante="closed" label="Clôturés" valeur={12} tendance="▲ 5 ce mois" trendClass="up" />
      </div>

      <div className="grid grid-2-1">
        <div>
          <Card
            titre="Signalements récents"
            sousTitre="Les 3 dernières heures"
            actions={
              <Link className="badge-soft" to="/signalements">
                Tout voir →
              </Link>
            }
          >
            {recents.map((s) => (
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
                    {(s.priorite === 'critique' || s.priorite === 'elevee') && (
                      <Chip variante="prio">Prioritaire</Chip>
                    )}
                    <ChipCategorie categorie={s.categorie} />
                  </>
                }
              />
            ))}
          </Card>

          <Card titre="Évolution des signalements" sousTitre="Nombre de signalements par mois — 2026">
            <Histogramme donnees={MOIS} />
          </Card>
        </div>

        <div>
          <Card titre="Actions en retard" sousTitre="Échéance dépassée">
            {actionsEnRetard.map((a) => (
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
            ))}
          </Card>

          <Card titre="Répartition par catégorie" sousTitre="30 derniers jours">
            <Barres
              donnees={CATEGORIES.map((c) => ({
                label: c.label,
                valeur: c.valeur,
                couleur: c.couleur,
              }))}
            />
          </Card>

          <Card
            titre="Assistant IA"
            sousTitre="142 consignes validées · propositions à vérifier"
          >
            <Alert variante="purple" emoji="🤖" titre="Classification assistée">
              Un signalement décrit en langage courant est automatiquement rattaché à une
              catégorie de risque, avec les consignes correspondantes.
            </Alert>
            <div style={{ marginTop: 14 }}>
              <Link className="btn block" to="/assistant">
                Ouvrir l'assistant
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <Card titre="État du traitement par site" sousTitre="Signalements ouverts et actions en retard par périmètre">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Site</th>
                <th>Secteur</th>
                <th>Ouverts</th>
                <th>En retard</th>
                <th>Utilisateurs</th>
                <th>Zones</th>
              </tr>
            </thead>
            <tbody>
              {SITES.map((s) => (
                <tr key={s.id}>
                  <td>{s.nom}</td>
                  <td>{s.secteur}</td>
                  <td>{s.ouverts}</td>
                  <td>
                    {s.en_retard > 0 ? (
                      <Chip variante="late">{s.en_retard}</Chip>
                    ) : (
                      <Chip variante="closed">0</Chip>
                    )}
                  </td>
                  <td>{s.utilisateurs}</td>
                  <td>{s.zones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
