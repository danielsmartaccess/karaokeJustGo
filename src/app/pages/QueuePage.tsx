import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import {
  getCurrentPerformance,
  getQueue,
  leaveQueue,
  subscribeToPerformances,
  type QueueEntry,
} from '@/data/performances';
import { readActiveSession } from '@/lib/active-session';

/**
 * Fila da sessão (FASE 5) + quem está chamado/cantando agora (FASE 6), ao vivo via
 * Realtime. Votar é FASE 7.
 */
export function QueuePage() {
  const [activeSession] = useState(readActiveSession);
  const [current, setCurrent] = useState<QueueEntry | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
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
      const [currentPerformance, entries] = await Promise.all([
        getCurrentPerformance(activeSession.id),
        getQueue(activeSession.id),
      ]);
      setCurrent(currentPerformance);
      setQueue(entries);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar a fila.');
    } finally {
      setLoading(false);
    }
  }, [activeSession]);

  useEffect(() => {
    void load();
    if (!activeSession) return;
    return subscribeToPerformances(activeSession.id, () => void load());
  }, [activeSession, load]);

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
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Voltar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-6 py-12">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Fila
        </h1>
        <p className="text-sm text-muted">Sessão {activeSession.code}</p>
      </div>

      {errorMessage && <p className="text-center text-sm text-glow-400">{errorMessage}</p>}

      {loading && <p className="text-center text-sm text-muted">Carregando…</p>}

      {current?.isMine && (
        <div className="flex flex-col items-center gap-3 rounded-card border border-brand-500 bg-stage-800 px-5 py-6 text-center">
          <p className="text-2xl">🎤</p>
          <p className="text-lg font-bold text-brand-400">
            {current.status === 'PERFORMING' ? 'Você está cantando agora!' : 'Você foi chamado!'}
          </p>
          <p className="text-muted">{current.song?.title}</p>
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
          <span className="text-ink">{current.performerName}</span> — {current.song?.title}
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
            className={`flex items-center justify-between gap-3 rounded-card border px-4 py-3 ${
              entry.isMine ? 'border-brand-500 bg-stage-800' : 'border-stage-700 bg-stage-800'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg font-bold text-muted">{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {entry.song?.title ?? 'Música'}
                  {entry.isMine && <span className="ml-2 text-xs text-brand-400">você</span>}
                </p>
                <p className="truncate text-sm text-muted">
                  {entry.song?.artist} · {entry.performerName}
                </p>
              </div>
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

      <Link to="/songs" className="text-center text-sm text-brand-400 hover:text-brand-300">
        ← Buscar outra música
      </Link>

      <Link to="/" className="text-center text-sm text-muted hover:text-ink">
        ← Voltar
      </Link>
    </main>
  );
}
