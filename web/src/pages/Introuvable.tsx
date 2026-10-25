import { Link } from 'react-router-dom';
import { Card, Empty } from '../components/ui';

export default function Introuvable() {
  return (
    <Card titre="Page introuvable">
      <Empty emoji="🧭">
        Cette page n'existe pas ou a été déplacée.
        <div style={{ marginTop: 14 }}>
          <Link className="btn" to="/">
            Retour au tableau de bord
          </Link>
        </div>
      </Empty>
    </Card>
  );
}
