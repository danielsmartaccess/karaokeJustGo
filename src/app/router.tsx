import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { JoinPage } from './pages/JoinPage';
import { HostPage } from './pages/HostPage';
import { SongsPage } from './pages/SongsPage';
import { QueuePage } from './pages/QueuePage';
import { DisplayPage } from './pages/DisplayPage';
import { VotePage } from './pages/VotePage';

/**
 * Roteamento das três experiências (seções 32–33).
 * O basename usa o BASE_URL do Vite para funcionar sob o subcaminho do GitHub Pages.
 */
export function AppRouter() {
  const basename = import.meta.env.BASE_URL;

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        {/* PARTICIPANTE (mobile-first) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/songs" element={<SongsPage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/vote" element={<VotePage />} />
        <Route path="/profile" element={<PlaceholderPage scope="Participante" title="Perfil" phase="FASE 8 — Gamificação" />} />

        {/* HOST */}
        <Route path="/host" element={<HostPage />} />

        {/* TELÃO (público) */}
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/display/session/:code" element={<DisplayPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
