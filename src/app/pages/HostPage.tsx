import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { QrCode } from '@/ui/QrCode';
import { cn } from '@/lib/utils';
import {
  createSession,
  listVenueSessions,
  openSession,
  goLive,
  closeSession,
  broadcastCta,
  showRankingOnTelao,
  clearDisplayOverride,
  sendPlaybackCommand,
  getParticipantCount,
  subscribeToSessionParticipants,
  type Session,
  type CtaMessage,
  type PlaybackCommand,
} from '@/data/sessions';
import { parseYouTubeId, youtubeWatchUrl, youtubeKaraokeSearchUrl } from '@/lib/youtube';
import { ensureAnonymousSession, getDefaultVenue, getMyVenueStaffRole } from '@/data/identity';
import { canTransition, type SessionState } from '@/domain/session/state-machine';
import {
  callNext,
  completePerformance,
  finishVoting,
  getCurrentPerformance,
  getQueue,
  getVotingPerformance,
  leaveQueue,
  markPerforming,
  setPerformanceVideo,
  startVoting,
  subscribeToPerformances,
  type QueueEntry,
} from '@/data/performances';
import { getResults, type PerformanceResult } from '@/data/votes';
import { announcePerformanceOfTheNight, getPerformanceOfTheNight, type AwardWithDetails } from '@/data/awards';
import { VOTING_WINDOW_SECONDS } from '@/domain/voting/rules';
import type { Tables } from '@/lib/database.types';

type Venue = Tables<'venues'>;

const STATUS_LABEL: Record<SessionState, string> = {
  SCHEDULED: 'Agendada',
  OPEN: 'Aberta',
  LIVE: 'Ao vivo',
  CLOSED: 'Encerrada',
};

const STATUS_DOT: Record<SessionState, string> = {
  SCHEDULED: 'bg-muted',
  OPEN: 'bg-brand-400',
  LIVE: 'bg-glow-500',
  CLOSED: 'bg-spotlight-500',
};

const STATUS_TEXT: Record<SessionState, string> = {
  SCHEDULED: 'text-muted',
  OPEN: 'text-brand-400',
  LIVE: 'text-glow-400',
  CLOSED: 'text-spotlight-400',
};

const STATUS_BORDER: Record<SessionState, string> = {
  SCHEDULED: 'border-stage-600 bg-stage-700/30',
  OPEN: 'border-brand-500/40 bg-brand-500/10',
  LIVE: 'border-glow-500/40 bg-glow-500/10',
  CLOSED: 'border-spotlight-500/40 bg-spotlight-500/10',
};

const CTA_OPTIONS: Array<{ msg: CtaMessage; label: string; icon: string; colorClass: string }> = [
  { msg: 'qr', label: 'Escaneie o QR', icon: '📱', colorClass: 'text-brand-400 border-brand-500/35 bg-brand-500/10' },
  { msg: 'pedido', label: 'Peça sua música', icon: '🎵', colorClass: 'text-brand-300 border-brand-400/35 bg-brand-400/10' },
  { msg: 'vote', label: 'Vote agora!', icon: '🗳', colorClass: 'text-glow-500 border-glow-500/35 bg-glow-500/10' },
  { msg: 'next', label: 'Quem canta a próxima?', icon: '🎤', colorClass: 'text-glow-400 border-glow-400/35 bg-glow-400/10' },
  { msg: 'celebrate', label: 'Comemore com a gente!', icon: '🎉', colorClass: 'text-spotlight-400 border-spotlight-500/35 bg-spotlight-500/10' },
];

function secondsLeft(votingStartedAt: string | null): number {
  if (!votingStartedAt) return VOTING_WINDOW_SECONDS;
  const elapsed = (Date.now() - new Date(votingStartedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(VOTING_WINDOW_SECONDS - elapsed));
}

/**
 * Painel do host (FASE 3): criar e controlar sessões do venue. O papel HOST/ADMIN
 * vem de `venue_staff` — não existe login separado, é a mesma identidade anônima
 * do participante (docs/SECURITY.md, docs/ARCHITECTURE.md).
 * FASE 6: chamar o próximo da fila e marcar quem está cantando, ao vivo (Realtime).
 * Cabine do host: QR code, contagem de participantes, comando remoto de play/pause
 * do vídeo em cena, CTAs para o telão e ranking sob demanda.
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
  const [queueBySession, setQueueBySession] = useState<Record<string, QueueEntry[]>>({});
  const [queueLoadingBySession, setQueueLoadingBySession] = useState<Record<string, boolean>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [currentBySession, setCurrentBySession] = useState<Record<string, QueueEntry | null>>({});
  const [votingBySession, setVotingBySession] = useState<Record<string, QueueEntry | null>>({});
  const [resultsByPerformance, setResultsByPerformance] = useState<
    Record<string, PerformanceResult | null>
  >({});
  const [callingSessionId, setCallingSessionId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [votingBusyId, setVotingBusyId] = useState<string | null>(null);
  const [awardBySession, setAwardBySession] = useState<Record<string, AwardWithDetails | null>>({});
  const [announcingSessionId, setAnnouncingSessionId] = useState<string | null>(null);
  const [confirmAwardSessionId, setConfirmAwardSessionId] = useState<string | null>(null);
  // FASE 10: link do YouTube que o host cola para o cantor chamado.
  const [videoInputBySession, setVideoInputBySession] = useState<Record<string, string>>({});
  // Redesign: QR ampliado, contagem de participantes, comando de playback, CTAs.
  const [qrModalSessionId, setQrModalSessionId] = useState<string | null>(null);
  const [participantCountBySession, setParticipantCountBySession] = useState<Record<string, number>>({});
  const [playbackBusySessionId, setPlaybackBusySessionId] = useState<string | null>(null);
  const [ctaFeedbackBySession, setCtaFeedbackBySession] = useState<Record<string, string | null>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const unsubscribers = ids.flatMap((id) => {
      void refreshCurrent(id);
      void refreshVoting(id);
      void refreshQueue(id);
      void refreshParticipantCount(id);
      return [
        subscribeToPerformances(id, () => {
          void refreshCurrent(id);
          void refreshVoting(id);
          void refreshQueue(id);
        }),
        subscribeToSessionParticipants(id, () => {
          void refreshParticipantCount(id);
        }),
      ];
    });
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [openOrLiveIds]);

  // Encerra a votação sozinha quando os 60s acabam — sem precisar de cron/servidor,
  // desde que a aba do host fique aberta (é quem está rodando o show).
  useEffect(() => {
    const timers = Object.entries(votingBySession).flatMap(([sessionId, entry]) => {
      if (entry?.status !== 'VOTING' || !entry.votingStartedAt) return [];
      const elapsedMs = Date.now() - new Date(entry.votingStartedAt).getTime();
      const delay = Math.max(0, VOTING_WINDOW_SECONDS * 1000 - elapsedMs) + 500;
      const timerId = window.setTimeout(() => {
        void finishVoting(entry.id)
          .then(() => refreshVoting(sessionId))
          .catch(() => undefined);
      }, delay);
      return [timerId];
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [votingBySession]);

  // Só para repintar o anel de contagem regressiva da votação a cada segundo.
  useEffect(() => {
    const anyVoting = Object.values(votingBySession).some((entry) => entry?.status === 'VOTING');
    if (!anyVoting) return;
    const interval = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(interval);
  }, [votingBySession]);

  async function refreshCurrent(sessionId: string) {
    try {
      const entry = await getCurrentPerformance(sessionId);
      setCurrentBySession((prev) => ({ ...prev, [sessionId]: entry }));
    } catch {
      // silencioso — não trava o resto do dashboard
    }
  }

  async function refreshVoting(sessionId: string) {
    try {
      const entry = await getVotingPerformance(sessionId);
      setVotingBySession((prev) => ({ ...prev, [sessionId]: entry }));
      if (entry?.status === 'RESULT') {
        const results = await getResults(entry.id);
        setResultsByPerformance((prev) => ({ ...prev, [entry.id]: results }));
      }
    } catch {
      // silencioso — não trava o resto do dashboard
    }
  }

  async function refreshQueue(sessionId: string) {
    setQueueLoadingBySession((prev) => ({ ...prev, [sessionId]: true }));
    try {
      const list = await getQueue(sessionId);
      setQueueBySession((prev) => ({ ...prev, [sessionId]: list }));
    } catch {
      // silencioso — não trava o resto do dashboard
    } finally {
      setQueueLoadingBySession((prev) => ({ ...prev, [sessionId]: false }));
    }
  }

  async function refreshParticipantCount(sessionId: string) {
    try {
      const count = await getParticipantCount(sessionId);
      setParticipantCountBySession((prev) => ({ ...prev, [sessionId]: count }));
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
      if (r) {
        const list = await listVenueSessions(v.id);
        setSessions(list);
        for (const s of list) {
          if (s.status === 'CLOSED') void refreshAward(s.id);
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar o painel do host.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshAward(sessionId: string) {
    try {
      const award = await getPerformanceOfTheNight(sessionId);
      setAwardBySession((prev) => ({ ...prev, [sessionId]: award }));
    } catch {
      // silencioso — não trava o resto do dashboard
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
      if (updated.status === 'CLOSED') void refreshAward(updated.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível atualizar a sessão.');
    } finally {
      setBusySessionId(null);
    }
  }

  async function handleAnnounceAward(session: Session) {
    setAnnouncingSessionId(session.id);
    setErrorMessage('');
    try {
      await announcePerformanceOfTheNight(session.id);
      await refreshAward(session.id);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível anunciar a Performance da Noite.',
      );
    } finally {
      setAnnouncingSessionId(null);
    }
  }

  async function handleRemoveFromQueue(session: Session, entry: QueueEntry) {
    setRemovingId(entry.id);
    setErrorMessage('');
    try {
      await leaveQueue(entry.id, entry.status);
      await refreshQueue(session.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível remover da fila.');
    } finally {
      setRemovingId(null);
    }
  }

  async function clearRankingIfShown(session: Session) {
    if (!session.display_override) return;
    try {
      const updated = await clearDisplayOverride(session.id);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      // silencioso — não é crítico se o ranking não sumir sozinho
    }
  }

  async function handleCallNext(session: Session) {
    setCallingSessionId(session.id);
    setErrorMessage('');
    try {
      await callNext(session.id);
      await refreshCurrent(session.id);
      await refreshQueue(session.id);
      await clearRankingIfShown(session);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível chamar o próximo.');
    } finally {
      setCallingSessionId(null);
    }
  }

  async function handleMarkPerforming(session: Session, entry: QueueEntry) {
    const raw = (videoInputBySession[session.id] ?? '').trim();
    let video: { youtubeVideoId: string | null; youtubeUrl: string | null } | undefined;
    if (raw) {
      const id = parseYouTubeId(raw);
      if (!id) {
        setErrorMessage('Link do YouTube não reconhecido — cole a URL do vídeo (ou o id).');
        return;
      }
      video = { youtubeVideoId: id, youtubeUrl: youtubeWatchUrl(id) };
    }
    setMarkingId(entry.id);
    setErrorMessage('');
    try {
      await markPerforming(entry.id, video);
      setVideoInputBySession((prev) => ({ ...prev, [session.id]: '' }));
      await refreshCurrent(session.id);
      await clearRankingIfShown(session);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível marcar como cantando.');
    } finally {
      setMarkingId(null);
    }
  }

  async function handleSetPerformanceVideo(session: Session, entry: QueueEntry) {
    const id = parseYouTubeId(videoInputBySession[session.id] ?? '');
    if (!id) {
      setErrorMessage('Link do YouTube não reconhecido — cole a URL do vídeo (ou o id).');
      return;
    }
    setMarkingId(entry.id);
    setErrorMessage('');
    try {
      await setPerformanceVideo(entry.id, { youtubeVideoId: id, youtubeUrl: youtubeWatchUrl(id) });
      setVideoInputBySession((prev) => ({ ...prev, [session.id]: '' }));
      await refreshCurrent(session.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível trocar o vídeo.');
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

  async function handleSkip(session: Session, entry: QueueEntry) {
    setMarkingId(entry.id);
    setErrorMessage('');
    try {
      await leaveQueue(entry.id, entry.status);
      await callNext(session.id);
      await refreshCurrent(session.id);
      await refreshQueue(session.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível pular.');
    } finally {
      setMarkingId(null);
    }
  }

  async function handleStartVoting(session: Session, entry: QueueEntry) {
    setMarkingId(entry.id);
    setErrorMessage('');
    try {
      await startVoting(entry.id);
      await refreshCurrent(session.id);
      await refreshVoting(session.id);
      await clearRankingIfShown(session);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível iniciar a votação.');
    } finally {
      setMarkingId(null);
    }
  }

  async function handleFinishVotingNow(session: Session, entry: QueueEntry) {
    setVotingBusyId(entry.id);
    setErrorMessage('');
    try {
      await finishVoting(entry.id);
      await refreshVoting(session.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível encerrar a votação.');
    } finally {
      setVotingBusyId(null);
    }
  }

  async function handleComplete(session: Session, entry: QueueEntry) {
    setVotingBusyId(entry.id);
    setErrorMessage('');
    try {
      await completePerformance(entry.id);
      await refreshVoting(session.id);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível concluir.');
    } finally {
      setVotingBusyId(null);
    }
  }

  async function handlePlayback(session: Session, command: PlaybackCommand) {
    setPlaybackBusySessionId(session.id);
    setErrorMessage('');
    try {
      await sendPlaybackCommand(session.id, command);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível enviar o comando ao telão.');
    } finally {
      setPlaybackBusySessionId(null);
    }
  }

  async function handleBroadcastCta(session: Session, message: CtaMessage, label: string) {
    setErrorMessage('');
    try {
      await broadcastCta(session.id, message);
      setCtaFeedbackBySession((prev) => ({ ...prev, [session.id]: label }));
      window.setTimeout(() => {
        setCtaFeedbackBySession((prev) => ({ ...prev, [session.id]: null }));
      }, 2500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível chamar o telão.');
    }
  }

  async function handleShowRanking(session: Session) {
    setErrorMessage('');
    try {
      const updated = await showRankingOnTelao(session.id);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível mostrar o ranking.');
    }
  }

  async function handleHideRanking(session: Session) {
    setErrorMessage('');
    try {
      const updated = await clearDisplayOverride(session.id);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível fechar o ranking.');
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
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
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

      <div className="flex flex-col gap-5">
        {sessions.length === 0 && (
          <p className="text-center text-sm text-muted">Nenhuma sessão ainda.</p>
        )}

        {sessions.map((session) => {
          const current = currentBySession[session.id];
          const voting = votingBySession[session.id];
          const results = voting ? resultsByPerformance[voting.id] : null;
          const isOpenOrLive = session.status === 'OPEN' || session.status === 'LIVE';
          const queue = queueBySession[session.id] ?? [];
          const rawLink = videoInputBySession[session.id] ?? '';
          const previewId = parseYouTubeId(rawLink) || current?.youtubeVideoId || null;
          const canControlPlayback = Boolean(current?.youtubeVideoId);

          return (
            <div key={session.id} className="glass rounded-card p-4 sm:p-5">
              {/* Cabeçalho da sessão */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted">Sessão</p>
                  <p className="font-mono text-3xl font-bold tracking-[0.2em] text-brand-400">
                    {session.code}
                  </p>
                </div>

                <div
                  className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5', STATUS_BORDER[session.status])}
                >
                  <span className={cn('h-2 w-2 rounded-full animate-pulse', STATUS_DOT[session.status])} />
                  <span
                    className={cn('text-sm font-bold', STATUS_TEXT[session.status])}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {STATUS_LABEL[session.status]}
                  </span>
                </div>

                {isOpenOrLive && (
                  <div className="flex items-center gap-1.5 text-sm text-muted">
                    <span>👥</span>
                    <span className="font-mono text-lg font-bold text-ink">
                      {participantCountBySession[session.id] ?? 0}
                    </span>
                    <span>conectados</span>
                  </div>
                )}

                {isOpenOrLive && (
                  <div className="flex flex-col gap-0.5 text-xs">
                    <a
                      href={joinUrl(session.code)}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-brand-400 hover:text-brand-300"
                    >
                      entrar ↗
                    </a>
                    <a
                      href={displayUrl(session.code)}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-brand-400 hover:text-brand-300"
                    >
                      telão ↗
                    </a>
                  </div>
                )}

                {isOpenOrLive && (
                  <button
                    onClick={() => setQrModalSessionId(session.id)}
                    className="ml-auto shrink-0 transition-transform hover:scale-110"
                    title="Ampliar QR Code"
                  >
                    <QrCode value={joinUrl(session.code)} size={56} />
                  </button>
                )}
              </div>

              {/* Performance da Noite (sessão encerrada) */}
              {session.status === 'CLOSED' && (
                <div className="mb-4 rounded-card border border-spotlight-500/50 bg-stage-700/60 p-4">
                  {awardBySession[session.id] ? (
                    <>
                      <p className="text-xs uppercase tracking-[0.15em] text-spotlight-400">
                        🏆 Performance da Noite
                      </p>
                      <p className="font-medium text-ink">
                        {awardBySession[session.id]?.performerName} —{' '}
                        {awardBySession[session.id]?.songTitle}
                      </p>
                    </>
                  ) : (
                    <Button
                      size="md"
                      disabled={announcingSessionId === session.id}
                      onClick={() => setConfirmAwardSessionId(session.id)}
                    >
                      {announcingSessionId === session.id ? '…' : '🏆 Anunciar Performance da Noite'}
                    </Button>
                  )}
                </div>
              )}

              {isOpenOrLive && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* Coluna principal: no ar agora + votação */}
                  <div className="flex flex-col gap-4 lg:col-span-2">
                    {current && (
                      <div className="glass-bright rounded-card p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-glow-500" />
                          <p
                            className="text-xs font-bold uppercase tracking-[0.2em] text-glow-400"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            {current.status === 'PERFORMING' ? 'No ar agora' : 'Chamado'}
                          </p>
                        </div>

                        <div className="mb-3 flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-xl font-bold text-ink"
                              style={{ fontFamily: 'var(--font-display)' }}
                            >
                              {current.performerName}
                            </p>
                            <p className="truncate text-sm text-brand-300">{current.songQuery}</p>
                          </div>
                          {current.status === 'PERFORMING' && (
                            <div className="flex items-end gap-0.5">
                              {[0.3, 0.6, 1, 0.7, 0.9, 0.5, 0.8].map((h, i) => (
                                <span
                                  key={i}
                                  className="w-1 animate-soundwave rounded-full bg-brand-500"
                                  style={{ height: `${h * 24}px`, animationDelay: `${i * 0.1}s` }}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mb-3 flex gap-2">
                          <Input
                            value={rawLink}
                            onChange={(e) =>
                              setVideoInputBySession((prev) => ({ ...prev, [session.id]: e.target.value }))
                            }
                            placeholder="Cole o link do YouTube de karaokê…"
                            className="flex-1 text-sm"
                          />
                          <a
                            href={youtubeKaraokeSearchUrl(current.songQuery)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex shrink-0 items-center gap-1 rounded-xl border border-glow-500/35 bg-glow-500/10 px-3 text-xs font-semibold text-glow-400 transition-transform hover:scale-105"
                          >
                            ▶ YT
                          </a>
                        </div>

                        <div className="mb-3 aspect-video overflow-hidden rounded-xl bg-stage-700">
                          {previewId ? (
                            <img
                              src={`https://img.youtube.com/vi/${previewId}/hqdefault.jpg`}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl text-stage-600">
                              ▶
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          <button
                            onClick={() => handlePlayback(session, 'PLAY')}
                            disabled={!canControlPlayback || playbackBusySessionId === session.id}
                            className="flex flex-col items-center gap-1 rounded-xl border border-brand-500/40 bg-brand-500/10 py-3 text-xs font-semibold text-brand-400 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            <span className="text-xl">▶</span>Play
                          </button>
                          <button
                            onClick={() => handlePlayback(session, 'PAUSE')}
                            disabled={!canControlPlayback || playbackBusySessionId === session.id}
                            className="flex flex-col items-center gap-1 rounded-xl border border-stage-600 bg-stage-700/50 py-3 text-xs font-semibold text-muted transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            <span className="text-xl">⏸</span>Pause
                          </button>
                          <button
                            onClick={() => handleSkip(session, current)}
                            disabled={markingId === current.id}
                            className="flex flex-col items-center gap-1 rounded-xl border border-stage-600 bg-stage-700/50 py-3 text-xs font-semibold text-muted transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            <span className="text-xl">⏭</span>Pular
                          </button>
                          {current.status === 'CALLED' && (
                            <button
                              onClick={() => handleMarkPerforming(session, current)}
                              disabled={markingId === current.id}
                              className="flex flex-col items-center gap-1 rounded-xl border border-brand-400/40 bg-brand-400/10 py-3 text-xs font-semibold text-brand-300 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                              style={{ fontFamily: 'var(--font-display)' }}
                            >
                              <span className="text-xl">🎤</span>Começou!
                            </button>
                          )}
                          {current.status === 'PERFORMING' && (
                            <button
                              onClick={() => handleStartVoting(session, current)}
                              disabled={markingId === current.id}
                              className="flex flex-col items-center gap-1 rounded-xl border border-glow-500/40 bg-glow-500/10 py-3 text-xs font-semibold text-glow-400 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                              style={{ fontFamily: 'var(--font-display)' }}
                            >
                              <span className="text-xl">🗳</span>Votar
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelCurrent(session, current)}
                            disabled={markingId === current.id}
                            className="flex flex-col items-center gap-1 rounded-xl border border-stage-600 bg-stage-700/50 py-3 text-xs font-semibold text-muted transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            <span className="text-xl">✕</span>Cancelar
                          </button>
                        </div>

                        {current.status === 'PERFORMING' && rawLink.trim() && (
                          <Button
                            size="md"
                            variant="outline"
                            className="mt-2 w-full"
                            disabled={markingId === current.id}
                            onClick={() => handleSetPerformanceVideo(session, current)}
                          >
                            Trocar vídeo
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Votação ao vivo */}
                    {voting && (
                      <div
                        className="animate-fade-in-up rounded-card border border-glow-500/40 p-4"
                        style={{
                          background:
                            'linear-gradient(135deg, color-mix(in srgb, var(--color-glow-500) 12%, transparent), color-mix(in srgb, var(--color-stage-900) 90%, transparent))',
                        }}
                      >
                        <div className="mb-4 flex items-center gap-4">
                          {voting.status === 'VOTING' &&
                            (() => {
                              const remaining = secondsLeft(voting.votingStartedAt);
                              const pct = (remaining / VOTING_WINDOW_SECONDS) * 100;
                              return (
                                <div className="relative h-16 w-16 shrink-0 animate-neon-pulse-glow rounded-full">
                                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                                    <circle
                                      cx="18"
                                      cy="18"
                                      r="15.9"
                                      fill="none"
                                      stroke="color-mix(in srgb, var(--color-glow-500) 20%, transparent)"
                                      strokeWidth="2.5"
                                    />
                                    <circle
                                      cx="18"
                                      cy="18"
                                      r="15.9"
                                      fill="none"
                                      stroke="var(--color-glow-500)"
                                      strokeWidth="2.5"
                                      strokeDasharray="100"
                                      strokeDashoffset={100 - pct}
                                      strokeLinecap="round"
                                      className="transition-all duration-1000"
                                    />
                                  </svg>
                                  <span className="absolute inset-0 flex items-center justify-center font-mono text-lg font-bold text-glow-400">
                                    {remaining}
                                  </span>
                                </div>
                              );
                            })()}
                          <div>
                            <p className="font-bold text-glow-400" style={{ fontFamily: 'var(--font-display)' }}>
                              {voting.status === 'VOTING' ? 'Votação em andamento!' : 'Resultado'}
                            </p>
                            <p className="text-sm text-muted">
                              {voting.performerName} — {voting.songQuery}
                            </p>
                          </div>
                        </div>

                        {voting.status === 'RESULT' && results && (
                          <div className="mb-3 rounded-xl border border-stage-600/40 bg-stage-800/60 p-3 text-center">
                            <p className="text-xs text-muted">Nota da Plateia</p>
                            <p className="font-mono text-3xl font-bold text-spotlight-400">
                              {results.audience_score ?? '—'}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {results.sing_along_percent}% cantariam junto · {results.vote_count} votos
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          {voting.status === 'VOTING' && (
                            <Button
                              size="md"
                              variant="outline"
                              disabled={votingBusyId === voting.id}
                              onClick={() => handleFinishVotingNow(session, voting)}
                            >
                              Encerrar votação agora
                            </Button>
                          )}
                          {voting.status === 'RESULT' && (
                            <Button
                              size="md"
                              disabled={votingBusyId === voting.id}
                              onClick={() => handleComplete(session, voting)}
                            >
                              Concluir
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Coluna lateral: fila + central do telão */}
                  <div className="flex flex-col gap-4">
                    <div className="glass rounded-card p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h2 className="font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                          Fila <span className="text-xs font-normal text-muted">{queue.length} aguardando</span>
                        </h2>
                        {!current && (
                          <button
                            onClick={() => handleCallNext(session)}
                            disabled={callingSessionId === session.id || queue.length === 0}
                            className="animate-neon-pulse rounded-full border border-brand-500/50 bg-brand-500/15 px-3 py-1.5 text-xs font-bold text-brand-400 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:animate-none disabled:opacity-40"
                            style={{ fontFamily: 'var(--font-display)' }}
                          >
                            {callingSessionId === session.id ? '…' : 'Chamar próximo ▶'}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {queueLoadingBySession[session.id] && (
                          <p className="text-sm text-muted">Carregando fila…</p>
                        )}
                        {!queueLoadingBySession[session.id] && queue.length === 0 && (
                          <p className="py-4 text-center text-sm text-muted">Fila vazia</p>
                        )}
                        {queue.map((entry, index) => (
                          <div
                            key={entry.id}
                            className="flex items-center gap-2.5 rounded-xl border border-stage-600/40 bg-stage-700/40 p-2.5"
                          >
                            <span
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold',
                                index === 0 ? 'bg-brand-500 text-stage-950' : 'bg-stage-700 text-muted',
                              )}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-ink">{entry.performerName}</p>
                              <p className="truncate text-xs text-muted">{entry.songQuery}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveFromQueue(session, entry)}
                              disabled={removingId === entry.id}
                              className="shrink-0 px-1 text-sm text-muted transition-colors hover:text-glow-400"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Central do Telão */}
                    <div className="glass rounded-card p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <h2 className="font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                          Central do Telão
                        </h2>
                        {ctaFeedbackBySession[session.id] && (
                          <span className="animate-fade-in-up text-xs text-brand-300">
                            📡 {ctaFeedbackBySession[session.id]}
                          </span>
                        )}
                      </div>
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        {CTA_OPTIONS.map((cta) => (
                          <button
                            key={cta.msg}
                            onClick={() => handleBroadcastCta(session, cta.msg, cta.label)}
                            className={cn(
                              'rounded-xl border p-3 text-left transition-all hover:scale-105 active:scale-95',
                              cta.colorClass,
                            )}
                          >
                            <span className="mb-1 block text-xl">{cta.icon}</span>
                            <span className="text-xs font-semibold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                              {cta.label}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-spotlight-500/30 to-transparent" />
                      {session.display_override === 'RANKING' ? (
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full border-spotlight-500/50 text-spotlight-400"
                          onClick={() => handleHideRanking(session)}
                        >
                          Fechar ranking do telão
                        </Button>
                      ) : (
                        <button
                          onClick={() => handleShowRanking(session)}
                          className="w-full animate-neon-pulse-spotlight rounded-xl border border-spotlight-500/45 bg-gradient-to-br from-spotlight-500/20 to-spotlight-400/5 py-3 text-sm font-bold text-spotlight-400 transition-transform hover:scale-105"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          🏆 Mostrar Ranking no Telão
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Ciclo de vida da sessão */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-stage-700/60 pt-4">
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
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/" className="text-center text-sm text-muted hover:text-ink">
        ← Voltar
      </Link>

      {/* Modal do QR Code ampliado */}
      {qrModalSessionId &&
        (() => {
          const s = sessions.find((x) => x.id === qrModalSessionId);
          if (!s) return null;
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-stage-950/90 p-4 backdrop-blur-md"
              onClick={() => setQrModalSessionId(null)}
            >
              <div
                className="glass-bright animate-score-reveal rounded-card p-8 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <QrCode value={joinUrl(s.code)} size={256} className="mx-auto mb-4" />
                <p className="mb-1 font-mono text-3xl font-bold tracking-[0.25em] text-brand-400">{s.code}</p>
                <p className="mb-4 break-all text-sm text-muted">{joinUrl(s.code)}</p>
                <button
                  onClick={() => setQrModalSessionId(null)}
                  className="text-sm text-muted hover:text-ink"
                >
                  Fechar
                </button>
              </div>
            </div>
          );
        })()}

      {/* Confirmação de anúncio da Performance da Noite */}
      {confirmAwardSessionId &&
        (() => {
          const s = sessions.find((x) => x.id === confirmAwardSessionId);
          if (!s) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-stage-950/90 p-4 backdrop-blur-md">
              <div className="glass-bright w-full max-w-sm animate-score-reveal rounded-card p-8 text-center">
                <div className="mb-4 text-5xl">⭐</div>
                <h2
                  className="mb-2 text-xl font-bold text-spotlight-400"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Anunciar Performance da Noite?
                </h2>
                <p className="mb-6 text-sm text-muted">
                  Isso vai revelar o grande vencedor no telão. Tem certeza?
                </p>
                <div className="flex gap-3">
                  <Button variant="ghost" className="flex-1" onClick={() => setConfirmAwardSessionId(null)}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={announcingSessionId === s.id}
                    onClick={async () => {
                      setConfirmAwardSessionId(null);
                      await handleAnnounceAward(s);
                    }}
                  >
                    Anunciar!
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
    </main>
  );
}
