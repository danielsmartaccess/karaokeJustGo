import { useEffect, useState } from 'react';
import {
  getMyBadges,
  getMyReputation,
  getSessionLeaderboard,
  subscribeToPointsTransactions,
  type EarnedBadge,
  type SessionReputation,
  type UserReputation,
} from '@/data/gamification';
import { readActiveSession } from '@/lib/active-session';

/**
 * Perfil do participante (FASE 8): XP total, badges conquistados e — se houver
 * sessão ativa — o ranking da noite. XP é só leitura aqui; quem grava são as
 * triggers do servidor (docs/SECURITY.md).
 */
export function ProfilePage() {
  const [activeSession] = useState(readActiveSession);
  const [reputation, setReputation] = useState<UserReputation | null>(null);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [leaderboard, setLeaderboard] = useState<SessionReputation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    void load();
    if (!activeSession) return;
    return subscribeToPointsTransactions(activeSession.id, () => void loadLeaderboard());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setErrorMessage('');
    try {
      const [rep, myBadges] = await Promise.all([getMyReputation(), getMyBadges()]);
      setReputation(rep);
      setBadges(myBadges);
      if (activeSession) await loadLeaderboard();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar o perfil.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard() {
    if (!activeSession) return;
    try {
      setLeaderboard(await getSessionLeaderboard(activeSession.id, 5));
    } catch {
      // silencioso — o resto do perfil segue funcionando
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-6 py-10 text-center">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Meu perfil
        </h1>
      </div>

      {errorMessage && <p className="text-sm text-glow-400">{errorMessage}</p>}
      {loading && <p className="text-muted">Carregando…</p>}

      {!loading && (
        <>
          <div className="glass-bright flex animate-fade-in-up flex-col items-center gap-1 rounded-card border border-brand-500/40 px-5 py-7">
            <p className="font-mono text-5xl font-bold text-brand-400">{reputation?.total_xp ?? 0}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">XP total</p>
          </div>

          <div>
            <p className="mb-3 text-left text-sm uppercase tracking-[0.2em] text-muted">Badges</p>
            {badges.length === 0 ? (
              <p className="text-left text-sm text-muted">Nenhum badge ainda — participe de uma sessão!</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {badges.map(({ badge, earnedAt }) => (
                  <li
                    key={badge.id}
                    className="flex items-center gap-3 rounded-card border border-stage-700 bg-stage-800 px-4 py-3 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-500/30 bg-brand-500/10 text-xl">
                      {badge.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{badge.name}</p>
                      <p className="text-sm text-muted">{badge.description}</p>
                    </div>
                    <span className="ml-auto shrink-0 text-xs text-muted">
                      {new Date(earnedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {activeSession && leaderboard.length > 0 && (
            <div>
              <p className="mb-3 text-left text-sm uppercase tracking-[0.2em] text-muted">
                🏆 Ranking desta sessão
              </p>
              <ol className="flex flex-col gap-2">
                {leaderboard.map((entry, index) => (
                  <li
                    key={entry.profile_id}
                    className="flex items-center gap-3 rounded-card border border-stage-700 bg-stage-800 px-4 py-3 text-left"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stage-700 font-mono text-xs font-bold text-muted">
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-ink">{entry.display_name}</span>
                    <span className="font-mono font-bold text-brand-400">{entry.session_xp} XP</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </main>
  );
}
