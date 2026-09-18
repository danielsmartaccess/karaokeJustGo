import { useEffect, useState, type ElementType } from 'react';
import { KaraokeProvider } from './store/KaraokeContext';
import ParticipantView from './views/ParticipantView';
import TVQueueView from './views/TVQueueView';
import HostView from './views/HostView';
import HostLogin from './views/HostLogin';
import { ROUTES, viewFromHash } from './lib/urls';
import type { AppView } from './types';
import { Mic2, Tv2, Star } from 'lucide-react';

const NAV_ITEMS: { id: AppView; label: string; icon: ElementType }[] = [
  { id: 'participant', label: 'Participar', icon: Mic2 },
  { id: 'tv', label: 'Modo Palco', icon: Tv2 },
  { id: 'host', label: 'Host', icon: Star },
];

const HOST_NAME_KEY = 'jg-karaoke:host-name';

function useHashRoute(): [AppView, (view: AppView) => void] {
  const [view, setView] = useState<AppView>(() => viewFromHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: AppView) => {
    window.location.hash = ROUTES[next];
  };

  return [view, navigate];
}

function AppContent() {
  const [view, navigate] = useHashRoute();
  const [hostName, setHostName] = useState<string | null>(() =>
    localStorage.getItem(HOST_NAME_KEY),
  );

  const handleHostEnter = (name: string) => {
    localStorage.setItem(HOST_NAME_KEY, name);
    setHostName(name);
  };

  const handleHostExit = () => {
    localStorage.removeItem(HOST_NAME_KEY);
    setHostName(null);
  };

  return (
    <div className="relative">
      {view === 'participant' && <ParticipantView onViewQueue={() => navigate('tv')} />}
      {view === 'tv' && <TVQueueView />}
      {view === 'host' &&
        (hostName ? (
          <HostView hostName={hostName} onExit={handleHostExit} />
        ) : (
          <HostLogin onEnter={handleHostEnter} />
        ))}

      {/* Bottom nav */}
      <nav
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-1.5 py-1.5 bg-[#0d0020]/95 border border-pink-900/40 rounded-2xl backdrop-blur-xl"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(233,30,140,0.12)' }}
      >
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => navigate(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              view === id
                ? 'text-white neon-glow-pink'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
            }`}
            style={view === id ? { background: '#e91e8c' } : {}}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <KaraokeProvider>
      <AppContent />
    </KaraokeProvider>
  );
}
