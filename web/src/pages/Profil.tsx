import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Interrupteur, ListeItem, Stat } from '../components/ui';

export default function Profil() {
  const [prefs, setPrefs] = useState({
    push: true,
    resume: true,
    horsLigne: false,
    compression: true,
  });

  const maj = (cle: keyof typeof prefs) => (valeur: boolean) =>
    setPrefs((p) => ({ ...p, [cle]: valeur }));

  return (
    <>
      <div className="page-head">
        <h1>Profil &amp; réglages</h1>
        <div className="sub">Compte, préférences, référentiels et application</div>
      </div>

      <div className="grid grid-2-1">
        <div>
          <Card>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div
                className="avatar"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,var(--brand-3),var(--brand))',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                SO
              </div>
              <div>
                <div style={{ fontSize: 19, fontWeight: 800 }}>Soumaïla Ouédraogo</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
                  Responsable HSE — Mine de Poura (Zone Nord)
                </div>
                <span className="badge-soft" style={{ marginTop: 6, display: 'inline-block' }}>
                  Profil actif
                </span>
              </div>
            </div>

            <div className="list" style={{ marginTop: 18 }}>
              <ListeItem
                emoji="📧"
                titre="s.ouedraogo@exemple.bf"
                droite={<span className="chip closed">Vérifié</span>}
              />
              <ListeItem
                emoji="🕐"
                titre="Dernière connexion"
                detail="25 oct. 2026 — 10:02"
              />
              <ListeItem emoji="🛡" titre="Rôle et périmètre" detail="5 sites · 29 zones · 142 consignes" />
            </div>
          </Card>

          <Card titre="Préférences">
            <div className="list" style={{ marginTop: 10 }}>
              <Interrupteur
                actif={prefs.push}
                onChange={maj('push')}
                titre="Notifications push"
                detail="Signalements prioritaires et actions en retard"
              />
              <Interrupteur
                actif={prefs.resume}
                onChange={maj('resume')}
                titre="Résumé hebdomadaire"
                detail="E-mail au directeur de site chaque lundi"
              />
              <Interrupteur
                actif={prefs.horsLigne}
                onChange={maj('horsLigne')}
                titre="Mode hors ligne"
                detail="Conserver les signalements sans connexion"
              />
              <Interrupteur
                actif={prefs.compression}
                onChange={maj('compression')}
                titre="Photos en compression réduite"
                detail="Utile en connexion mobile limitée"
              />
            </div>
          </Card>

          <Card titre="Application">
            <div className="list" style={{ marginTop: 10 }}>
              <ListeItem
                emoji="ℹ️"
                titre="À propos"
                detail="PrevEnSanté v0.2.0 — données fictives de démonstration"
                droite={<span className="arrow">›</span>}
              />
              <ListeItem
                emoji="📱"
                titre="Installer l'application"
                detail="Ajout à l'écran d'accueil (PWA)"
                droite={<span className="arrow">›</span>}
              />
              <ListeItem
                emoji="🔐"
                titre="Confidentialité & accès aux données médicales"
                droite={<span className="arrow">›</span>}
              />
              <ListeItem
                emoji="🚪"
                titre="Déconnexion"
                droite={<span className="arrow">›</span>}
              />
            </div>
          </Card>
        </div>

        <div>
          <Card titre="Référentiels administrés" sousTitre="Accès réservé à l'administrateur">
            <div className="list">
              <Link className="list-item" to="/sites">
                <span className="em">🏢</span>
                <div className="t">
                  Sites &amp; zones
                  <div className="d">6 sites · 29 zones</div>
                </div>
                <span className="arrow">›</span>
              </Link>
              <Link className="list-item" to="/sites">
                <span className="em">🗂</span>
                <div className="t">
                  Catégories de risques
                  <div className="d">9 catégories</div>
                </div>
                <span className="arrow">›</span>
              </Link>
              <Link className="list-item" to="/sites">
                <span className="em">👥</span>
                <div className="t">
                  Utilisateurs &amp; rôles
                  <div className="d">176 comptes</div>
                </div>
                <span className="arrow">›</span>
              </Link>
              <Link className="list-item" to="/assistant">
                <span className="em">📚</span>
                <div className="t">
                  Bibliothèque de consignes
                  <div className="d">142 documents validés</div>
                </div>
                <span className="arrow">›</span>
              </Link>
            </div>
          </Card>

          <Card titre="Mes activités" sousTitre="30 derniers jours">
            <div className="grid grid-2" style={{ gap: 12 }}>
              <Stat variante="total" label="Signalements créés" valeur={6} />
              <Stat variante="closed" label="Actions closes" valeur={11} />
              <Stat variante="info" label="Qualifications" valeur={9} />
              <Stat variante="open" label="Vérifications" valeur={4} />
            </div>
          </Card>

          <Alert variante="info" emoji="🔐" titre="Données médicales séparées">
            Les informations de santé sont stockées dans un dossier protégé, séparé des données générales de
            sécurité, avec des droits d'accès distincts.
          </Alert>
        </div>
      </div>
    </>
  );
}
