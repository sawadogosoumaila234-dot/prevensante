/** Page « Nouveau signalement » — formulaire de déclaration d'un événement. */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Champ } from '../components/ui';

const TYPES = [
  { cle: 'danger', emoji: '⚠️', libelle: 'Danger' },
  { cle: 'incident', emoji: '⚡', libelle: 'Incident' },
  { cle: 'accident', emoji: '🚑', libelle: 'Accident' },
];

const SITES = [
  'Mine de Poura — Zone Nord',
  'Cimenterie de Kossodo',
  'Carrière de Bobo',
  'Usine agro — Bobo-Dioulasso',
  'Entrepôt logistique — Ouaga',
  'Chantier BTP — Ouaga',
];

const ZONES = [
  'Front de taille — galerie 3',
  'Concasseur primaire',
  'Zone de stockage',
  'Atelier de maintenance',
  'Quai de chargement',
  'Galerie 4 — niveau -120',
];

const CATEGORIES = [
  'Mécanique — machine / équipement',
  'Électrique',
  'Chute de hauteur',
  "Chute d'objet / éboulement",
  'Produit chimique',
  'Manutention / effort',
  'Environnement (poussière, bruit, glissade)',
  'Incendie / explosion',
  "Circulation d'engins",
];

const PRIORITES = [
  'Critique — danger immédiat',
  'Élevée',
  'Moyenne',
  'Faible',
];

const ETAPES = [
  {
    titre: 'Enregistrement immédiat',
    detail: 'Le signalement apparaît dans le tableau de bord HSE avec son identifiant.',
  },
  {
    titre: 'Qualification',
    detail: 'Le responsable HSE évalue la gravité et confirme la catégorie de risque.',
  },
  {
    titre: 'Actions correctives',
    detail: 'Des actions sont attribuées avec responsable et échéance.',
  },
  {
    titre: 'Vérification et clôture',
    detail: 'La clôture est validée par une personne compétente du site.',
  },
];

export default function Signaler() {
  const [type, setType] = useState<string>('danger');
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState(false);

  function envoyer() {
    if (envoi) return;
    setEnvoi(true);
    window.setTimeout(() => {
      setEnvoi(false);
      setSucces(true);
      window.setTimeout(() => {
        setSucces(false);
      }, 1500);
    }, 800);
  }

  return (
    <>
      <div className="page-head">
        <h1>Nouveau signalement</h1>
        <div className="sub">Type d'événement, localisation, catégorie et description · F02</div>
      </div>

      <Alert
        variante="danger"
        emoji="🚨"
        titre="Danger grave ou immédiat ?"
      >
        Mettez-vous en sécurité d'abord et appliquez les procédures d'urgence du site.
        L'application ne remplace ni l'alarme, ni l'arrêt d'urgence, ni les consignes de
        consignation.
      </Alert>

      <div className="grid grid-2-1">
        {/* ── COLONNE GAUCHE ─────────────────────────────── */}
        <div>
          <Card
            titre="Informations de l'événement"
            sousTitre="Les champs marqués d'un astérisque sont obligatoires"
          >
            <Champ label="Type d'événement" requis>
              <div className="type-picker">
                {TYPES.map((t) => (
                  <div
                    key={t.cle}
                    className={`type-card${type === t.cle ? ' sel' : ''}`}
                    data-type={t.cle}
                    role="button"
                    tabIndex={0}
                    onClick={() => setType(t.cle)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setType(t.cle);
                      }
                    }}
                  >
                    <span className="em">{t.emoji}</span>
                    <span className="lab">{t.libelle}</span>
                  </div>
                ))}
              </div>
            </Champ>

            <div className="form-grid">
              <Champ label="Site" requis>
                <select className="select" defaultValue={SITES[0]}>
                  {SITES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Champ>

              <Champ label="Zone" requis>
                <select className="select" defaultValue={ZONES[0]}>
                  {ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </Champ>

              <Champ label="Date et heure du constat" requis>
                <input className="input" type="datetime-local" defaultValue="2026-10-25T10:15" />
              </Champ>

              <Champ label="Activité en cours" requis>
                <input
                  className="input"
                  placeholder="Ex. : intervention de maintenance, circulation d'engin…"
                />
              </Champ>
            </div>

            <Champ
              label="Catégorie de risque"
              requis
              hint="🤖 L'assistant peut proposer une catégorie à partir de votre description."
            >
              <select className="select" defaultValue={CATEGORIES[0]}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Champ>

            <Champ label="Description de la situation" requis>
              <textarea
                className="textarea"
                placeholder="Décrivez ce qui s'est passé, les circonstances, les personnes concernées, les conséquences observées…"
              />
            </Champ>

            <div className="form-grid">
              <Champ label="Équipement concerné (facultatif)">
                <input
                  className="input"
                  placeholder="Ex. : chargeuse LHD n°2, convoyeur n°2…"
                />
              </Champ>

              <Champ label="Niveau de priorité apparent">
                <select className="select" defaultValue={PRIORITES[1]}>
                  {PRIORITES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Champ>
            </div>

            <Champ label="Mesures immédiates déjà prises">
              <textarea
                className="textarea"
                style={{ minHeight: 80 }}
                placeholder="Zone balisée, équipement consigné, EPI porté…"
              />
            </Champ>

            <Champ label="Photo (facultative)">
              <div className="photo-zone">
                <div className="em">📷</div>
                <div className="t">Ajouter une photo</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>JPG ou PNG — 5 Mo maximum</div>
              </div>
            </Champ>

            <button type="button" className="btn yellow block" onClick={envoyer} disabled={envoi}>
              {envoi ? 'Envoi en cours…' : succes ? '✅ Signalement créé — SIG-2026-049' : 'Envoyer le signalement'}
            </button>

            <div className="hint" style={{ textAlign: 'center', marginTop: 9 }}>
              Un identifiant unique est attribué automatiquement (SIG-2026-049).
            </div>
          </Card>
        </div>

        {/* ── COLONNE DROITE ─────────────────────────────── */}
        <div>
          <Card titre="Ce qui se passe ensuite">
            <div className="timeline">
              {ETAPES.map((e, i) => (
                <div className="tl-item" key={e.titre}>
                  <span className="dot">{i + 1}</span>
                  <div className="c">
                    <div className="t">{e.titre}</div>
                    <div className="d">{e.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card titre="Confidentialité" sousTitre="Séparation des données médicales">
            <Alert variante="info" emoji="ℹ️">
              Les informations de santé sont saisies dans le dossier médical protégé, distinct
              des données générales de sécurité. Le médecin du travail y accède dans le cadre de
              ses missions.
            </Alert>
            <Link className="btn ghost block" to="/assistant">
              🤖 Demander conseil à l'assistant avant d'envoyer
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
