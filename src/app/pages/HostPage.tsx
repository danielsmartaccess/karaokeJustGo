import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import {
  createSession,
  listVenueSessions,
  openSession,
  goLive,
  closeSession,
  type Session,
} from '@/data/sessions';
import { ensureAnonymousSession, getDefaultVenue, getMyVenueStaffRole } from '@/data/identity';
import { canTransition, type SessionState } from '@/domain/session/state-machine';
import {
  callNext,
  getCurrentPerformance,
  getQueue,
  leaveQueue,
  markPerforming,
  subscribeToPerformances,
  type QueueEntry,
} from '@/data/performances';
import type { Tables } from '@/lib/database.types';

type Venue = Tables<'venues'>;

const STATUS_LABEL: Record<SessionState, string> = {
  SCHEDULED: 'Agendada',
  OPEN: 'Aberta',
  LIVE: 'Ao vivo',
  CLOSED: 'Encerrada',
};

/**
 * Painel do host (FASE 3): criar e controlar sessões do venue. O papel HOST/ADMIN
 * vem de `venue_staff` — não existe login separado, é a mesma identidade anônima
 * do participante (docs/SECURITY.md, docs/ARCHITECTURE.md).
 * FASE 6: chamar o próximo da fila e marcar quem está cantando, ao vivo (Realtime).
 */
export function HostPage() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [profileId, setProfileId] = useState('');
  const [venue, setVenue] = useState<Venue | null>(null);
  const [role, setRole] = useState<'HOST' | 'ADMIN' | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [creating, setCreating] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [currentBySession, setCurrentBySession] = useState<Record<string, QueueEntry | null>>({});
  const [callingSessionId, setCallingSessionId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  const openOrLiveIds = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'OPEN' || s.status === 'LIVE')
        .map((s) => s.id)
        .join(','),
    [sessions],
  );

  useEffect(() => {
    const ids = openOrLiveIds ? openOrLiveIds.split(',') : [];
    const unsubscribers = ids.map((id) => {
      void refreshCurrent(id);
      return subscribeToPerformances(id, () => void refreshCurrent(id));
    });
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [openOrLiveIds]);

  async function refreshCurrent(sessionId: string) {
    try {
      const entry = await getCurrentPerformance(sessionId);
      setCurrentBySession((prev) => ({ ...prev, [sessionId]: entry }));
    } catch {
      // silencioso — não trava o resto do dashboard
    }
  }

  async function bootstrap() {
    setLoading(true);
    setErrorMessage('');
    try {
      const userId = await ensureAnonymousSession();
      setProfileId(userId);
      const v = await getDefaultVenue();
      setVenue(v);
      const r = await getMyVenueStaffRole(v.id);
      setRole(r);
      if (r) setSessions(await listVenueSessions(v.id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar o painel do host.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSession() {
    if (!venue) return;
    setCreating(true);
    setErrorMessage('');
    try {
      const session = await createSession(venue.id);
      setSessions((prev) => [session, ...prev]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível criar a sessão.');
    } finally {
      setCreating(false);
    }
  }

  async function handleTransition(session: Session, action: typeof openSession) {
    setBusySessionId(session.id);
    setErrorMessage('');
    try {
      const updated = await action(session);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível atualizar a sessão.');
    } finally {
      setBusySessionId(null);
    }
  }

  async function toggleQueue(session: Session) {
    if (expandedSessionId === session.id) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(session.id);
    setQueueLoading(true);
    setErrorMessage('');
    setQueue([]);
    try {
      setQueue(await getQueue(session.id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar a fila.');
    } finally {
      setQueueLoading(false);
    }
  }

  async function handleRemoveFromQueue(session: Session, entry: QueueEntry) {
    setRemovingId(entry.id);
    setErrorMessage('');
    try {
      await leaveQueue(entry.id, entry.status);
      setQueue(await getQueue(session.id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível remover da fila.');
    } finally {
      setRemovingId(null);
    }
  }

  async function handleCallNext(session: Session) {
    setCallingSessionId(session.id);
    setErrorMessage('');
    try {
      await callNext(session.id);
      await refreshCurrent(session.id);
      if (expandedSessionId === session.id) setQueue(await getQueue(session.id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível chamar o próximo.');
    } finally {
      setCallingSessionId(null);
    }
  }

  async function handleMarkPerforming(session: Session, entry: QueueEntry) {
    setMarkingId(entry.id);
    setErrorMessage('');
    try {
      await markPerforming(entry.id);
      await refreshCurrent(session.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível marcar como cantando.');
    } finally {
      setMarkingId(null);
    }
  }

  async function handleCancelCurrent(session: Session, entry: QueueEntry) {
    setMarkingId(entry.id);
    setErrorMessage('');
    try {
      await leaveQueue(entry.id, entry.status);
      await refreshCurrent(session.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível cancelar.');
    } finally {
      setMarkingId(null);
    }
  }

  function joinUrl(code: string) {
    return `${window.location.origin}${import.meta.env.BASE_URL}join/${code}`;
  }

  function displayUrl(code: string) {
    return `${window.location.origin}${import.meta.env.BASE_URL}display/session/${code}`;
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-muted">Carregando painel do host…</p>
      </main>
    );
  }

  if (errorMessage && !venue) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">Não foi possível carregar</h1>
        <p className="text-muted">{errorMessage}</p>
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Voltar
        </Link>
      </main>
    );
  }

  if (!role) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Host</p>
        <h1 className="text-2xl font-bold">Sem permissão de host</h1>
        <p className="text-muted">
          Seu perfil ainda não tem acesso de HOST/ADMIN em {venue?.name}. Peça a um admin para
          liberar o acesso com o id abaixo.
        </p>
        <code className="rounded-card border border-stage-700 bg-stage-800 px-4 py-3 text-xs text-ink break-all">
          {profileId}
        </code>
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Voltar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-6 py-12">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Host</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          {venue?.name}
        </h1>
      </div>

      {errorMessage && (
        <p className="rounded-card border border-glow-500/40 bg-stage-800 px-4 py-3 text-center text-sm text-glow-400">
          {errorMessage}
        </p>
      )}

      <Button onClick={handleCreateSession} disabled={creating} size="lg">
        {creating ? 'Criando…' : '+ Nova sessão'}
      </Button>

      <div className="flex flex-col gap-4">
        {sessions.length === 0 && (
          <p className="text-center text-sm text-muted">Nenhuma sessão ainda.</p>
        )}

        {sessions.map((session) => {
          const current = currentBySession[session.id];
          const isOpenOrLive = session.status === 'OPEN' || session.status === 'LIVE';
          return (
            <div key={session.id} className="rounded-card border border-stage-700 bg-stage-800 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold tracking-[0.2em]">{session.code}</p>
                  <p className="text-sm text-muted">{STATUS_LABEL[session.status]}</p>
                </div>
                {isOpenOrLive && (
                  <div className="flex flex-col items-end gap-1 text-xs">
                    <a
                      href={joinUrl(session.code)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-400 hover:text-brand-300 break-all"
                    >
                      entrar
                    </a>
                    <a
                      href={displayUrl(session.code)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-400 hover:text-brand-300 break-all"
                    >
                      telão
                    </a>
                  </div>
                )}
              </div>

              {isOpenOrLive && current && (
                <div className="mb-3 rounded-card border border-brand-500 bg-stage-700 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-brand-400">
                    {current.status === 'PERFORMING' ? '🎤 Cantando agora' : 'Chamado'}
                  </p>
                  <p className="font-medium text-ink">
                    {current.performerName} — {current.song?.title}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {current.status === 'CALLED' && (
                      <Button
                        size="md"
                        disabled={markingId === current.id}
                        onClick={() => handleMarkPerforming(session, current)}
                      >
                        Começou a cantar
                      </Button>
                    )}
                    <Button
                      size="md"
                      variant="outline"
                      disabled={markingId === current.id}
                      onClick={() => handleCancelCurrent(session, current)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {canTransition(session.status, 'OPEN') && (
                  <Button
                    size="md"
                    disabled={busySessionId === session.id}
                    onClick={() => handleTransition(session, openSession)}
                  >
                    Abrir
                  </Button>
                )}
                {canTransition(session.status, 'LIVE') && (
                  <Button
                    size="md"
                    disabled={busySessionId === session.id}
                    onClick={() => handleTransition(session, goLive)}
                  >
                    Ao vivo
                  </Button>
                )}
                {canTransition(session.status, 'CLOSED') && (
                  <Button
                    size="md"
                    variant="outline"
                    disabled={busySessionId === session.id}
                    onClick={() => handleTransition(session, closeSession)}
                  >
                    Encerrar
                  </Button>
                )}
                {isOpenOrLive && !current && (
                  <Button
                    size="md"
                    disabled={callingSessionId === session.id}
                    onClick={() => handleCallNext(session)}
                  >
                    {callingSessionId === session.id ? '…' : 'Chamar próximo'}
                  </Button>
                )}
                {isOpenOrLive && (
                  <Button size="md" variant="ghost" onClick={() => toggleQueue(session)}>
                    {expandedSessionId === session.id ? 'Ocultar fila' : 'Ver fila'}
                  </Button>
                )}
              </div>

              {expandedSessionId === session.id && (
                <div className="mt-3 flex flex-col gap-2 border-t border-stage-700 pt-3">
                  {queueLoading && <p className="text-sm text-muted">Carregando fila…</p>}
                  {!queueLoading && queue.length === 0 && (
                    <p className="text-sm text-muted">Fila vazia.</p>
                  )}
                  {queue.map((entry, index) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="text-muted">{index + 1}.</span>{' '}
                        <span className="text-ink">{entry.song?.title}</span>{' '}
                        <span className="text-muted">— {entry.performerName}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="md"
                        disabled={removingId === entry.id}
                        onClick={() => handleRemoveFromQueue(session, entry)}
                        className="shrink-0 text-glow-400"
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Link to="/" className="text-center text-sm text-muted hover:text-ink">
        ← Voltar
      </Link>
    </main>
  );
}
