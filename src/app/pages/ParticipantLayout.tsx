import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/songs', icon: '🎵', label: 'Pedir' },
  { to: '/queue', icon: '📋', label: 'Fila' },
  { to: '/vote', icon: '🗳', label: 'Votar' },
  { to: '/profile', icon: '👤', label: 'Perfil' },
];

/**
 * Layout compartilhado do participante pós-entrada: mantém as rotas /songs, /queue,
 * /vote e /profile independentes (deep-link, botão voltar) e só acrescenta a barra
 * de abas inferior fixa do redesign por cima delas.
 */
export function ParticipantLayout() {
  return (
    <div className="min-h-dvh bg-stage-900">
      <div className="pb-24">
        <Outlet />
      </div>
      <nav
        className="glass-bright fixed inset-x-0 bottom-0 z-30 flex items-center justify-around px-2 py-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
                isActive ? 'bg-brand-500/15 text-brand-400' : 'text-muted hover:text-ink',
              )
            }
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
