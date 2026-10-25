import { Card, Chip, ListeItem, Stat } from '../components/ui';
import { CATEGORIES_RISQUE, SITES, ZONES_POU } from '../data/demo';

export default function Sites() {
  return (
    <>
      <div className="page-head row">
        <div>
          <h1>Sites, zones &amp; référentiels</h1>
          <div className="sub">Gestion multi-sites et multi-secteurs · F01</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn yellow sm">＋ Nouveau site</button>
          <button className="btn secondary sm">＋ Nouvelle zone</button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <Stat variante="total" label="Sites" valeur={6} tendance="6 secteurs représentés" />
        <Stat variante="info" label="Zones" valeur={29} tendance="galeries, ateliers, chantiers" />
        <Stat variante="open" label="Catégories de risques" valeur={9} tendance="adaptées par secteur" />
        <Stat variante="closed" label="Consignes validées" valeur={142} tendance="6 référentiels" />
      </div>

      <Card titre="Sites" sousTitre="Chaque site est rattaché à un secteur d'activité">
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
                  <td>
                    <b>{s.nom}</b>
                  </td>
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

      <div className="grid grid-2">
        <Card titre="Catégories de risques" sousTitre="Applicables selon le secteur du site">
          <div className="list">
            {CATEGORIES_RISQUE.map((c) => (
              <ListeItem
                key={c.label}
                emoji={c.emoji}
                titre={c.label}
                droite={<Chip variante="cat">{c.secteur}</Chip>}
              />
            ))}
          </div>
        </Card>

        <Card titre="Zones de la Mine de Poura" sousTitre="Exemple de découpage par zone de travail">
          <div className="list">
            {ZONES_POU.map((z) => (
              <ListeItem key={z.nom} emoji={z.emoji} titre={z.nom} detail={z.risques} />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
