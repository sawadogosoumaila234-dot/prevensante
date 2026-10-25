import { Route, Routes } from 'react-router-dom';
import { Coquille } from './components/Coquille';
import TableauDeBord from './pages/TableauDeBord';
import Signaler from './pages/Signaler';
import Signalements from './pages/Signalements';
import Actions from './pages/Actions';
import Pilotage from './pages/Pilotage';
import Assistant from './pages/Assistant';
import Notifications from './pages/Notifications';
import Sites from './pages/Sites';
import Profil from './pages/Profil';
import Introuvable from './pages/Introuvable';

export default function App() {
  return (
    <Coquille>
      <Routes>
        <Route path="/" element={<TableauDeBord />} />
        <Route path="/signaler" element={<Signaler />} />
        <Route path="/signalements" element={<Signalements />} />
        <Route path="/actions" element={<Actions />} />
        <Route path="/pilotage" element={<Pilotage />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/sites" element={<Sites />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="*" element={<Introuvable />} />
      </Routes>
    </Coquille>
  );
}
