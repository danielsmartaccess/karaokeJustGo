import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import { getQueue, leaveQueue, type QueueEntry } from '@/data/performances';
import { readActiveSession } from '@/lib/active-session';

/**
 * Fila da sessão (FASE 5): quem já entrou, em ordem de chegada. Ser chamado/cantar é
 * FASE 6 — aqui só existe entrar (via /songs) e sair da fila.
 */
export function QueuePage() {
  const [activeSession] = useState(readActiveSession);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    if (!activeSession) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    setQueue([]);
    try {
      setQueue(await getQueue(activeSession.id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar a fila.');
    } finally {
      setLoading(false);
    }
  }, [activeSession]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function handleLeave(entry: QueueEntry) {
    setLeavingId(entry.id);
    setErrorMessage('');
    try {
      await leaveQueue(entry.id, entry.status);
      await loadQueue();
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

      {!loading && queue.length === 0 && (
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
