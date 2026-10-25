import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Chip, ListeItem } from '../components/ui';
import { CONSIGNES } from '../data/demo';

interface Message {
  role: 'user' | 'ai';
  texte: string;
  categorie?: string;
  refs?: { icone: string; texte: string }[];
  role_titre?: string;
}

const REPONSES = [
  {
    categorie: 'Chute de hauteur',
    texte:
      "Risque identifié : chute depuis une hauteur non protégée.\n\nConseils immédiats :\n1. Vérifier la présence et l'état des garde-corps.\n2. Contrôler les EPI antichute (harnais, ligne de vie).\n3. Baliser la zone et interdire l'accès non sécurisé.",
  },
  {
    categorie: 'Électrique',
    texte:
      "Risque identifié : contact ou arc électrique.\n\nConseils immédiats :\n1. Consigner l'équipement avant intervention.\n2. Vérifier l'absence de tension (VAT).\n3. Utiliser les EPI isolants adaptés.",
  },
  {
    categorie: 'Mécanique',
    texte:
      "Risque identifié : écrasement ou happement par un organe en mouvement.\n\nConseils immédiats :\n1. Consigner et cadenasser la machine.\n2. Vérifier protecteurs et carters.\n3. Respecter la procédure de consignation LOTO.",
  },
  {
    categorie: 'Chimique',
    texte:
      "Risque identifié : contact ou inhalation de produit chimique.\n\nConseils immédiats :\n1. Porter masque et gants de protection adaptés.\n2. Évacuer et aérer la zone.\n3. Vérifier la présence d'un bac de rétention.",
  },
];

const QUESTIONS = [
  "Précautions avant une intervention de maintenance sur un convoyeur ?",
  'Quels EPI pour un travail en hauteur à 3 m ?',
  'Que faire en cas de fuite de produit chimique ?',
];

const INITIAL: Message[] = [
  {
    role: 'ai',
    role_titre: '🤖 Assistant PrevEnSanté',
    texte:
      "Bonjour. Décrivez une situation et je proposerai une catégorie de risque ainsi que les consignes issues des documents validés.",
    refs: [
      { icone: '📄', texte: 'Corpus : 142 consignes validées' },
      {
        icone: '🏢',
        texte: 'Secteurs : mines, cimenteries, usines, métallurgie, logistique, BTP',
      },
    ],
  },
  {
    role: 'user',
    texte: 'Un ouvrier a glissé sur un sol huileux près du concasseur, sans blessure. Que faire ?',
  },
  {
    role: 'ai',
    role_titre: '🤖 Proposition de catégorie',
    categorie: 'Manutention / environnement',
    texte:
      'Risque de glissade sur surface souillée.\n\nConseils immédiats :\n1. Baliser la zone et nettoyer le sol huileux.\n2. Vérifier l\'EPI antidérapant.\n3. Signaler un entretien préventif du concasseur.',
    refs: [
      { icone: '📚', texte: 'Consigne C-042 « Nettoyage des zones mécaniques »' },
      { icone: '📚', texte: 'Consigne C-118 « EPI — chaussures de sécurité S3 »' },
      {
        icone: '⚠️',
        texte: 'Limites : classification automatique, à valider par un responsable.',
      },
    ],
  },
];

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [saisie, setSaisie] = useState('');
  const [analyse, setAnalyse] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    zoneRef.current?.scrollTo({ top: zoneRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, analyse]);

  function envoyer(question: string) {
    const texte = question.trim();
    if (!texte || analyse) return;

    setMessages((m) => [...m, { role: 'user', texte }]);
    setSaisie('');
    setAnalyse(true);

    window.setTimeout(() => {
      const r = REPONSES[Math.floor(Math.random() * REPONSES.length)];
      const ref = `C-${String(Math.floor(Math.random() * 200) + 10).padStart(3, '0')}`;
      setMessages((m) => [
        ...m,
        {
          role: 'ai',
          role_titre: '🤖 Proposition de catégorie',
          categorie: r.categorie,
          texte: r.texte,
          refs: [
            { icone: '📚', texte: `Consigne ${ref} — document validé` },
            {
              icone: '⚠️',
              texte: 'Limites : proposition automatique, à valider par un responsable HSE.',
            },
          ],
        },
      ]);
      setAnalyse(false);
    }, 700);
  }

  return (
    <>
      <div className="page-head">
        <h1>Assistant IA de prévention</h1>
        <div className="sub">Classification assistée et recherche de consignes validées · F05</div>
      </div>

      <Alert variante="purple" emoji="🤖" titre="Suggestions à vérifier">
        L'assistant s'appuie uniquement sur une bibliothèque de documents validés. Il ne remplace pas les
        procédures de consignation, les autorisations de travail ni les décisions des responsables compétents.
      </Alert>

      <div className="grid grid-2-1">
        <Card titre="Conversation" sousTitre="Corpus : 142 consignes validées · 6 secteurs couverts">
          <div className="chat" ref={zoneRef}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                {m.role_titre && <div className="role">{m.role_titre}</div>}
                {m.categorie && <b>{m.categorie}</b>}
                <div style={{ marginTop: m.categorie ? 8 : 0 }}>{m.texte}</div>
                {m.refs && (
                  <div className="refs">
                    {m.refs.map((r, j) => (
                      <div className="ref" key={j}>
                        <span>{r.icone}</span> {r.texte}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {analyse && (
              <div className="msg ai">
                <div className="role">🤖 Analyse en cours…</div>
                <span className="typing">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
          </div>

          <div className="ai-input">
            <input
              className="input"
              value={saisie}
              placeholder="Décrivez une situation de travail…"
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') envoyer(saisie);
              }}
            />
            <button className="ai-send" onClick={() => envoyer(saisie)} aria-label="Envoyer">
              ➤
            </button>
          </div>

          <div className="ai-suggest">
            {QUESTIONS.map((q) => (
              <button key={q} onClick={() => envoyer(q)}>
                {q}
              </button>
            ))}
          </div>
        </Card>

        <div>
          <Card titre="Fonctions de l'IA" sousTitre="Trois usages prioritaires, tous soumis à vérification humaine">
            <div className="grid" style={{ gap: 12 }}>
              <div className="item" style={{ margin: 0 }}>
                <div className="ic ai">🏷</div>
                <div className="body">
                  <div className="title">Classification des signalements</div>
                  <div className="desc">
                    Identifier une catégorie de risque à partir de la description du travailleur.
                  </div>
                </div>
              </div>
              <div className="item" style={{ margin: 0 }}>
                <div className="ic ai">📚</div>
                <div className="body">
                  <div className="title">Assistance à la prévention</div>
                  <div className="desc">
                    Retrouver la consigne correspondant au secteur, à l'équipement et au danger.
                  </div>
                </div>
              </div>
              <div className="item" style={{ margin: 0 }}>
                <div className="ic ai">📈</div>
                <div className="body">
                  <div className="title">Analyse des tendances</div>
                  <div className="desc">
                    Repérer les catégories de dangers qui reviennent fréquemment.
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card titre="Bibliothèque de consignes" sousTitre="Documents validés par les spécialistes">
            <div className="list">
              {CONSIGNES.map((c) => (
                <ListeItem
                  key={c.code}
                  emoji="📄"
                  titre={c.titre}
                  droite={
                    <Chip variante={c.statut === 'validee' ? 'closed' : 'verify'}>
                      {c.statut === 'validee' ? 'Validée' : 'En révision'}
                    </Chip>
                  }
                />
              ))}
            </div>
            <Link className="btn ghost block" to="/sites">
              Gérer le corpus de consignes
            </Link>
          </Card>

          <Alert variante="danger" emoji="🚫" titre="Limites explicites">
            L'IA ne déclare jamais un site sûr, n'autorise pas une intervention dangereuse et ne remplace pas
            les procédures d'urgence.
          </Alert>
        </div>
      </div>
    </>
  );
}