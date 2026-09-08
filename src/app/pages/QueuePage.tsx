import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import { cn } from '@/lib/utils';
import {
  getCurrentPerformance,
  getQueue,
  getVotingPerformance,
  leaveQueue,
  subscribeToPerformances,
  type QueueEntry,
} from '@/data/performances';
import { getPerformanceOfTheNight, subscribeToAwards, type AwardWithDetails } from '@/data/awards';
import { readActiveSession } from '@/lib/active-session';

/**
 * Fila da sessão (FASE 5) + quem está chamado/cantando/em votação (FASE 6/7), ao
 * vivo via Realtime.
 */
export function QueuePage() {
  const [activeSession] = useState(readActiveSession);
  const [current, setCurrent] = useState<QueueEntry | null>(null);
  const [voting, setVoting] = useState<QueueEntry | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [award, setAward] = useState<AwardWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeSession) {
      setLoading(false);
      return;
    }
    setErrorMessage('');
    try {
      const [currentPerformance, votingPerformance, entries] = await Promise.all([
        getCurrentPerformance(activeSession.id),
        getVotingPerformance(activeSession.id),
        getQueue(activeSession.id),
      ]);
      setCurrent(currentPerformance);
      setVoting(votingPerformance);
      setQueue(entries);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar a fila.');
    } finally {
      setLoading(false);
    }
  }, [activeSession]);

  const loadAward = useCallback(async () => {
    if (!activeSession) return;
    try {
      setAward(await getPerformanceOfTheNight(activeSession.id));
    } catch {
      // silencioso — não bloqueia o resto da tela
    }
  }, [activeSession]);

  useEffect(() => {
    void load();
    void loadAward();
    if (!activeSession) return;
    const unsubPerformances = subscribeToPerformances(activeSession.id, () => void load());
    const unsubAwards = subscribeToAwards(activeSession.id, () => void loadAward());
    return () => {
      unsubPerformances();
      unsubAwards();
    };
  }, [activeSession, load, loadAward]);

  async function handleLeave(entry: QueueEntry) {
    setLeavingId(entry.id);
    setErrorMessage('');
    try {
      await leaveQueue(entry.id, entry.status);
      await load();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível sair da fila.');
    } finally {
      setLeavingId(null);
    }
  }

  if (!activeSession) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>
        <h1 className="text-2xl font-bold">Fila</h1>
        <p className="text-muted">
          Você ainda não entrou em uma sessão —{' '}
          <Link to="/join" className="text-brand-400 hover:text-brand-300">
            entrar agora
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-6 py-10">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Fila
        </h1>
        <p className="font-mono text-sm text-muted">Sessão {activeSession.code}</p>
      </div>

      {errorMessage && <p className="text-center text-sm text-glow-400">{errorMessage}</p>}

      {award && (
        <div className="rounded-card border border-spotlight-500/50 bg-stage-800 px-4 py-3 text-center text-sm text-spotlight-400">
          🏆 Performance da Noite: {award.performerName} — {award.songTitle}
        </div>
      )}

      {loading && <p className="text-center text-sm text-muted">Carregando…</p>}

      {current?.isMine && (
        <div className="glass-bright animate-neon-pulse flex flex-col items-center gap-3 rounded-card border border-brand-500/50 px-5 py-7 text-center">
          <p className="text-3xl">🎤</p>
          <p className="text-lg font-bold text-brand-400" style={{ fontFamily: 'var(--font-display)' }}>
            {current.status === 'PERFORMING' ? 'Você está cantando agora!' : 'Você foi chamado!'}
          </p>
          <p className="text-muted">{current.songQuery}</p>
          <Button
            variant="outline"
            size="md"
            disabled={leavingId === current.id}
            onClick={() => handleLeave(current)}
          >
            {leavingId === current.id ? '…' : 'Desistir'}
          </Button>
        </div>
      )}

      {current && !current.isMine && (
        <p className="text-center text-sm text-muted">
          {current.status === 'PERFORMING' ? '🎤 Cantando agora:' : 'Chamado:'}{' '}
          <span className="text-ink">{current.performerName}</span> — {current.songQuery}
        </p>
      )}

      {voting && !voting.isMine && (
        <Link
          to="/vote"
          className="animate-neon-pulse-glow rounded-card border border-glow-500/50 bg-glow-500/10 px-4 py-3 text-center text-sm font-semibold text-glow-400 hover:text-glow-300"
        >
          {voting.status === 'VOTING'
            ? `🗳️ Vote em ${voting.performerName} agora!`
            : `🏆 Resultado de ${voting.performerName} disponível`}
        </Link>
      )}

      {voting?.isMine && (
        <p className="text-center text-sm text-muted">
          {voting.status === 'VOTING'
            ? 'A plateia está votando na sua apresentação!'
            : 'Seu resultado está pronto.'}{' '}
          <Link to="/vote" className="text-brand-400 hover:text-brand-300">
            ver
          </Link>
        </p>
      )}

      {!loading && queue.length === 0 && !current && (
        <p className="text-center text-sm text-muted">
          Ninguém na fila ainda —{' '}
          <Link to="/songs" className="text-brand-400 hover:text-brand-300">
            escolha uma música
          </Link>
          .
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {queue.map((entry, index) => (
          <li
            key={entry.id}
            className={cn(
              'flex items-center gap-3 rounded-card border px-4 py-3',
              entry.isMine ? 'border-brand-500/50 bg-brand-500/10' : 'border-stage-700 bg-stage-800',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stage-700 font-mono text-sm font-bold text-muted">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">
                {entry.songQuery}
                {entry.isMine && <span className="ml-2 text-xs text-brand-400">você</span>}
              </p>
              <p className="truncate text-sm text-muted">{entry.performerName}</p>
            </div>
            {entry.isMine && (
              <Button
                variant="outline"
                size="md"
                disabled={leavingId === entry.id}
                onClick={() => handleLeave(entry)}
                className="shrink-0"
              >
                {leavingId === entry.id ? '…' : 'Sair'}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
