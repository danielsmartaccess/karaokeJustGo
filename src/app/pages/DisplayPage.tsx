import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { QrCode } from '@/ui/QrCode';
import {
  getSessionByCode,
  subscribeToSession,
  getParticipantCount,
  subscribeToSessionParticipants,
  type Session,
  type CtaMessage,
} from '@/data/sessions';
import { youtubeEmbedUrl } from '@/lib/youtube';
import { getVenueById, type Venue } from '@/data/identity';
import {
  getCurrentPerformance,
  getQueue,
  getVotingPerformance,
  subscribeToPerformances,
  type QueueEntry,
} from '@/data/performances';
import { getResults, type PerformanceResult } from '@/data/votes';
import {
  getSessionLeaderboard,
  subscribeToPointsTransactions,
  type SessionReputation,
} from '@/data/gamification';
import { getPerformanceOfTheNight, subscribeToAwards, type AwardWithDetails } from '@/data/awards';
import { VOTING_WINDOW_SECONDS } from '@/domain/voting/rules';

function secondsLeft(votingStartedAt: string | null): number {
  if (!votingStartedAt) return 0;
  const elapsed = (Date.now() - new Date(votingStartedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(VOTING_WINDOW_SECONDS - elapsed));
}

const CTA_CONTENT: Record<CtaMessage, { title: string; subtitle: string; color: string }> = {
  qr: {
    title: 'Escaneie o QR Code!',
    subtitle: 'Aponte a câmera e entre na roda',
    color: 'var(--color-brand-500)',
  },
  pedido: {
    title: 'Peça Sua Música!',
    subtitle: 'Acesse pelo QR e escolha sua canção',
    color: 'var(--color-brand-400)',
  },
  vote: {
    title: 'Vote Agora!',
    subtitle: 'Avalie a performance ao vivo',
    color: 'var(--color-glow-500)',
  },
  next: {
    title: 'Quem Canta a Próxima?',
    subtitle: 'Inscreva-se pelo app!',
    color: 'var(--color-glow-400)',
  },
  celebrate: {
    title: 'Comemore com a Gente!',
    subtitle: 'Que performance incrível!',
    color: 'var(--color-spotlight-400)',
  },
};

function SpotlightBeams() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="animate-spotlight-sweep absolute left-[20%] top-0 h-full w-48 opacity-[0.07]"
        style={{
          background: 'linear-gradient(to bottom, var(--color-brand-500), transparent)',
          clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)',
        }}
      />
      <div
        className="animate-spotlight-sweep absolute right-[15%] top-0 h-full w-56 opacity-[0.06]"
        style={{
          background: 'linear-gradient(to bottom, var(--color-glow-500), transparent)',
          clipPath: 'polygon(25% 0%, 75% 0%, 100% 100%, 0% 100%)',
          animationDelay: '1.5s',
        }}
      />
      <div
        className="animate-spotlight-sweep absolute left-[50%] top-0 h-full w-40 opacity-[0.05]"
        style={{
          background: 'linear-gradient(to bottom, var(--color-spotlight-500), transparent)',
          clipPath: 'polygon(35% 0%, 65% 0%, 80% 100%, 20% 100%)',
          animationDelay: '0.8s',
        }}
      />
    </div>
  );
}

function Confetti() {
  const colors = [
    'var(--color-glow-500)',
    'var(--color-brand-500)',
    'var(--color-spotlight-400)',
    'var(--color-brand-300)',
    'var(--color-spotlight-500)',
    'var(--color-glow-400)',
    'var(--color-ink)',
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {Array.from({ length: 60 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-sm"
          style={{
            width: `${4 + (i % 4)}px`,
            height: `${6 + (i % 5)}px`,
            left: `${(i * 1.67) % 100}%`,
            top: '-20px',
            background: colors[i % colors.length],
            animation: `confetti-fall ${2.5 + (i % 3)}s ${(i % 10) * 0.2}s linear infinite`,
            transform: `rotate(${(i * 37) % 360}deg)`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  loadVideoById(videoId: string): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          host?: string;
          playerVars?: Record<string, number>;
        },
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youTubeApiPromise: Promise<void> | null = null;
function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT) return Promise.resolve();
  if (youTubeApiPromise) return youTubeApiPromise;
  youTubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return youTubeApiPromise;
}

/**
 * Telão (FASE 6): tela pública, só leitura, para o venue projetar. Mostra quem está
 * cantando agora, a votação em andamento e o resultado, tudo em tempo real (Realtime).
 * Redesign: lobby com QR permanente, ranking sob demanda (`display_override`), CTA
 * disparado pelo host e controle remoto de play/pause via IFrame API do YouTube.
 */
export function DisplayPage() {
  const { code: codeParam } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [current, setCurrent] = useState<QueueEntry | null>(null);
  const [voting, setVoting] = useState<QueueEntry | null>(null);
  const [results, setResults] = useState<PerformanceResult | null>(null);
  const [upNext, setUpNext] = useState<QueueEntry[]>([]);
  const [ranking, setRanking] = useState<SessionReputation[]>([]);
  const [award, setAward] = useState<AwardWithDetails | null>(null);
  const [awardResults, setAwardResults] = useState<PerformanceResult | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(codeParam));
  const [errorMessage, setErrorMessage] = useState('');
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [, setTick] = useState(0);

  const playerRef = useRef<YouTubePlayer | null>(null);
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const lastAppliedCommandAtRef = useRef<string | null>(null);

  // O IFrame API do YouTube SUBSTITUI o elemento que recebe pelo <iframe>. Se esse
  // elemento for um nó que o React controla, o React quebra ("removeChild") ao
  // desmontar o telão — era o que travava a página. Damos ao YouTube um <div>
  // interno criado na mão, que o React nunca reconcilia; ele só cuida do wrapper.
  function destroyPlayer() {
    try {
      playerRef.current?.destroy();
    } catch {
      // o iframe já pode ter saído do DOM — ignorar
    }
    playerRef.current = null;
    loadedVideoIdRef.current = null;
    if (playerHostRef.current) playerHostRef.current.replaceChildren();
  }

  useEffect(() => {
    if (!codeParam) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage('');
      try {
        const found = await getSessionByCode(codeParam!);
        if (!found) {
          if (!cancelled) setErrorMessage('Sessão não encontrada.');
          return;
        }
        if (cancelled) return;
        setSession(found);
        setVenue(await getVenueById(found.venue_id));
        await refresh(found.id);
        await refreshRanking(found.id);
        await refreshAward(found.id);
        await refreshParticipantCount(found.id);
        const unsubPerformances = subscribeToPerformances(found.id, () => void refresh(found.id));
        const unsubPoints = subscribeToPointsTransactions(found.id, () => void refreshRanking(found.id));
        const unsubAwards = subscribeToAwards(found.id, () => void refreshAward(found.id));
        const unsubSession = subscribeToSession(found.id, () => void refreshSession(found.id));
        const unsubParticipants = subscribeToSessionParticipants(found.id, () =>
          void refreshParticipantCount(found.id),
        );
        unsubscribe = () => {
          unsubPerformances();
          unsubPoints();
          unsubAwards();
          unsubSession();
          unsubParticipants();
        };
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar o telão.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function refresh(sessionId: string) {
      const [currentPerformance, votingPerformance, queue] = await Promise.all([
        getCurrentPerformance(sessionId),
        getVotingPerformance(sessionId),
        getQueue(sessionId),
      ]);
      if (cancelled) return;
      setCurrent(currentPerformance);
      setVoting(votingPerformance);
      setUpNext(queue.slice(0, 5));
      if (votingPerformance?.status === 'RESULT') {
        const r = await getResults(votingPerformance.id);
        if (!cancelled) setResults(r);
      } else {
        setResults(null);
      }
    }

    async function refreshRanking(sessionId: string) {
      const top = await getSessionLeaderboard(sessionId, 5);
      if (!cancelled) setRanking(top);
    }

    async function refreshSession(sessionId: string) {
      const updated = await getSessionByCode(codeParam!);
      if (!cancelled && updated && updated.id === sessionId) setSession(updated);
    }

    async function refreshAward(sessionId: string) {
      const a = await getPerformanceOfTheNight(sessionId);
      if (!cancelled) setAward(a);
      if (a) {
        const r = await getResults(a.performance_id);
        if (!cancelled) setAwardResults(r);
      }
    }

    async function refreshParticipantCount(sessionId: string) {
      const count = await getParticipantCount(sessionId);
      if (!cancelled) setParticipantCount(count);
    }

    void load();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [codeParam]);

  // Repinta o anel de votação e faz o banner de CTA sumir sozinho depois de 5s.
  useEffect(() => {
    const votingActive = voting?.status === 'VOTING';
    const ctaMaybeActive = Boolean(session?.cta_message);
    if (!votingActive && !ctaMaybeActive) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [voting?.status, session?.cta_message, session?.cta_triggered_at]);

  const videoBranchActive = !award && session?.display_override !== 'RANKING' && !voting;
  const activeVideoId =
    videoBranchActive && current?.status === 'PERFORMING' && current.youtubeVideoId
      ? current.youtubeVideoId
      : null;

  // Player real do YouTube (IFrame API) — permite o host pausar/retomar remotamente.
  // Se a API não carregar em 4s (rede bloqueando youtube.com), cai para o <iframe> simples.
  useEffect(() => {
    if (!activeVideoId) {
      destroyPlayer();
      setApiUnavailable(false);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) setApiUnavailable(true);
    }, 4000);
    void loadYouTubeIframeApi().then(() => {
      window.clearTimeout(timeout);
      if (cancelled || !playerHostRef.current || !window.YT) return;
      setApiUnavailable(false);
      if (!playerRef.current) {
        const mount = document.createElement('div');
        mount.className = 'h-full w-full';
        playerHostRef.current.replaceChildren(mount);
        playerRef.current = new window.YT.Player(mount, {
          videoId: activeVideoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        });
        loadedVideoIdRef.current = activeVideoId;
      } else if (loadedVideoIdRef.current !== activeVideoId) {
        playerRef.current.loadVideoById(activeVideoId);
        loadedVideoIdRef.current = activeVideoId;
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [activeVideoId]);

  useEffect(() => {
    return () => {
      destroyPlayer();
    };
  }, []);

  // Comando remoto de play/pause disparado pelo host (Realtime via `subscribeToSession`).
  useEffect(() => {
    if (!session?.playback_command || !session.playback_command_at) return;
    if (lastAppliedCommandAtRef.current === session.playback_command_at) return;
    lastAppliedCommandAtRef.current = session.playback_command_at;
    const player = playerRef.current;
    if (!player) return;
    if (session.playback_command === 'PLAY') player.playVideo();
    if (session.playback_command === 'PAUSE') player.pauseVideo();
  }, [session?.playback_command, session?.playback_command_at]);

  function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) return;
    navigate(`/display/session/${code}`);
  }

  if (!codeParam) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Telão</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Qual sessão?
        </h1>
        <form onSubmit={handleCodeSubmit} className="flex w-full flex-col gap-3">
          <Input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            autoFocus
            className="text-center text-2xl font-bold uppercase tracking-[0.3em]"
          />
          <Button type="submit" size="lg" disabled={codeInput.trim().length < 4}>
            Mostrar
          </Button>
        </form>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-2xl font-bold">{errorMessage}</h1>
      </main>
    );
  }

  const joinUrl = session ? `${window.location.origin}${import.meta.env.BASE_URL}join/${session.code}` : '';
  const ctaElapsedMs = session?.cta_triggered_at
    ? Date.now() - new Date(session.cta_triggered_at).getTime()
    : Infinity;
  const ctaContent = session?.cta_message ? CTA_CONTENT[session.cta_message as CtaMessage] : null;
  const ctaVisible = Boolean(ctaContent) && ctaElapsedMs < 5000;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-stage-950 p-2 sm:p-6">
      <div
        className="relative w-full max-w-[1600px] select-none overflow-hidden rounded-card"
        style={{ aspectRatio: '16 / 9', background: 'var(--color-stage-950)', fontFamily: 'var(--font-display)' }}
      >
        <SpotlightBeams />

        {award ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-[5%]">
            <Confetti />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--color-spotlight-500) 28%, transparent) 0%, transparent 55%)',
              }}
            />
            <p className="z-20 mb-[1%] text-[1.5vw] uppercase tracking-[0.3em] text-spotlight-400">
              Performance da Noite
            </p>
            <div className="z-20 mb-[2%] animate-score-reveal text-[6vw] leading-none">⭐</div>
            <h1
              className="z-20 mb-[2%] text-center font-bold text-spotlight-400"
              style={{ fontSize: '6vw', textShadow: '0 0 60px color-mix(in srgb, var(--color-spotlight-500) 70%, transparent)' }}
            >
              {award.performerName}
            </h1>
            <p className="z-20 text-[1.6vw] text-ink">{award.songTitle}</p>
            {awardResults && (
              <div className="z-20 mt-[3%] flex gap-[3%]">
                <div className="glass-bright rounded-2xl px-[4%] py-[2%] text-center">
                  <p className="text-[0.9vw] text-muted">Nota da Plateia</p>
                  <p className="font-mono text-[2.2vw] font-bold text-spotlight-400">
                    {awardResults.audience_score ?? '—'}
                  </p>
                </div>
                <div className="glass-bright rounded-2xl px-[4%] py-[2%] text-center">
                  <p className="text-[0.9vw] text-muted">Cantaria junto</p>
                  <p className="font-mono text-[2.2vw] font-bold text-brand-300">
                    {awardResults.sing_along_percent ?? 0}%
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : session?.display_override === 'RANKING' ? (
          <div
            className="absolute inset-0 flex flex-col p-[5%]"
            style={{
              background:
                'radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-spotlight-500) 18%, transparent) 0%, transparent 45%)',
            }}
          >
            <div className="mb-[3%] text-center">
              <p className="text-[1.3vw] uppercase tracking-[0.3em] text-spotlight-400">Hall da Fama</p>
              <h2
                className="text-[4.2vw] font-bold text-ink"
                style={{ textShadow: '0 0 40px color-mix(in srgb, var(--color-spotlight-500) 35%, transparent)' }}
              >
                Ranking da Noite
              </h2>
              <p className="text-[1.1vw] text-muted">
                {venue?.name} · Sessão {session?.code}
              </p>
            </div>
            <div className="mx-auto flex w-full max-w-[60%] flex-1 flex-col justify-center gap-[1.5%]">
              {ranking.length === 0 && (
                <p className="text-center text-[1.2vw] text-muted">Ninguém pontuou ainda.</p>
              )}
              {ranking.map((entry, i) => (
                <div
                  key={entry.profile_id}
                  className="animate-hall-of-fame flex items-center gap-[3%] rounded-2xl px-[3%] py-[2%]"
                  style={{
                    background:
                      i === 0
                        ? 'linear-gradient(135deg, color-mix(in srgb, var(--color-spotlight-400) 22%, transparent), color-mix(in srgb, var(--color-spotlight-500) 12%, transparent))'
                        : 'color-mix(in srgb, var(--color-stage-700) 60%, transparent)',
                    border: `1px solid ${i === 0 ? 'color-mix(in srgb, var(--color-spotlight-400) 45%, transparent)' : 'color-mix(in srgb, var(--color-brand-500) 15%, transparent)'}`,
                    animationDelay: `${i * 0.12}s`,
                  }}
                >
                  <span
                    className="w-[4vw] shrink-0 text-center font-mono"
                    style={{ fontSize: '2.2vw' }}
                  >
                    {i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <span className="flex-1 font-bold text-ink" style={{ fontSize: '1.8vw' }}>
                    {entry.display_name}
                  </span>
                  <span className="font-mono font-bold text-spotlight-400" style={{ fontSize: '2vw' }}>
                    {entry.session_xp} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : voting ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-[5%]"
            style={{
              background:
                'radial-gradient(ellipse at 50% 25%, color-mix(in srgb, var(--color-glow-500) 20%, transparent) 0%, transparent 55%)',
            }}
          >
            <p className="mb-[1%] text-[1.3vw] font-bold uppercase tracking-[0.3em] text-glow-400">
              {voting.status === 'VOTING' ? 'Hora de votar!' : 'Nota da Plateia'}
            </p>
            <p className="mb-[3%] text-[3vw] font-bold text-ink">{voting.performerName}</p>
            <p className="mb-[3%] text-[1.4vw] text-brand-300">{voting.songQuery}</p>

            {voting.status === 'VOTING' &&
              (() => {
                const remaining = secondsLeft(voting.votingStartedAt);
                const pct = (remaining / VOTING_WINDOW_SECONDS) * 100;
                return (
                  <div
                    className="animate-neon-pulse-glow relative mb-[3%] rounded-full"
                    style={{ width: '13vw', height: '13vw' }}
                  >
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r="44"
                        fill="none"
                        stroke="color-mix(in srgb, var(--color-glow-500) 20%, transparent)"
                        strokeWidth="5"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="44"
                        fill="none"
                        stroke="var(--color-glow-500)"
                        strokeWidth="5"
                        strokeDasharray="276.46"
                        strokeDashoffset={276.46 - (pct / 100) * 276.46}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono font-bold leading-none text-glow-400" style={{ fontSize: '4vw' }}>
                        {remaining}
                      </span>
                      <span className="text-[0.9vw] text-muted">segundos</span>
                    </div>
                  </div>
                );
              })()}

            {voting.status === 'RESULT' && results && (
              <>
                <div className="mb-[2%] grid w-full max-w-[65%] grid-cols-4 gap-[2%]">
                  {[
                    { label: 'Voz', value: results.voice_avg, icon: '🎤' },
                    { label: 'Performance', value: results.performance_avg, icon: '🎭' },
                    { label: 'Carisma', value: results.charisma_avg, icon: '✨' },
                    { label: 'Diversão', value: results.fun_avg, icon: '🎉' },
                  ].map((cat, i) => (
                    <div
                      key={cat.label}
                      className="animate-score-reveal rounded-2xl border border-glow-500/35 bg-glow-500/10 py-[4%] text-center"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    >
                      <p className="mb-1 text-[2.2vw]">{cat.icon}</p>
                      <p className="mb-1 text-[1vw] font-bold text-glow-400">{cat.label}</p>
                      <p className="font-mono font-bold text-spotlight-400" style={{ fontSize: '3.5vw' }}>
                        {cat.value ?? '—'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="animate-score-reveal rounded-2xl border border-brand-400/40 bg-brand-400/10 px-[4%] py-[1.5%] text-center">
                  <p className="text-[0.9vw] text-muted">Cantaria junto?</p>
                  <p className="font-mono font-bold leading-none text-brand-300" style={{ fontSize: '3.5vw' }}>
                    {results.sing_along_percent ?? 0}%
                  </p>
                </div>
              </>
            )}
          </div>
        ) : current ? (
          <div className="absolute inset-0">
            {activeVideoId ? (
              apiUnavailable ? (
                <iframe
                  key={activeVideoId}
                  src={youtubeEmbedUrl(activeVideoId, { autoplay: true })}
                  title="Vídeo de karaokê"
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              ) : (
                <div ref={playerHostRef} className="h-full w-full" />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-stage-900">
                <p className="text-[1.6vw] text-muted">Preparando o vídeo…</p>
              </div>
            )}

            <div
              className="absolute left-0 right-0 top-0 flex items-center gap-[2%] px-[3%] py-[1.5%]"
              style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--color-stage-950) 85%, transparent), transparent)' }}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-glow-500" />
                <span className="text-[1.1vw] font-bold tracking-[0.15em] text-glow-400">AO VIVO</span>
              </div>
              <div className="h-4 w-px bg-white/20" />
              <span className="text-[1.6vw] font-bold text-ink">{current.performerName}</span>
              <span className="text-[1.2vw] text-muted">·</span>
              <span className="text-[1.2vw] text-brand-300">{current.songQuery}</span>
              {current.status === 'PERFORMING' && (
                <div className="ml-2 flex items-end gap-0.5">
                  {[0.4, 0.9, 1, 0.6, 0.8, 0.5, 0.7].map((h, i) => (
                    <span
                      key={i}
                      className="w-0.5 animate-soundwave rounded-full bg-brand-500"
                      style={{ height: `${h * 16}px`, animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="absolute bottom-[2%] right-[2%] flex flex-col items-center gap-1 opacity-60">
              <QrCode value={joinUrl} size={64} />
              <p className="font-mono text-[0.8vw] text-white">{session?.code}</p>
            </div>
          </div>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-[5%]"
            style={{
              background:
                'radial-gradient(ellipse at 35% 45%, color-mix(in srgb, var(--color-brand-500) 14%, transparent) 0%, transparent 55%), radial-gradient(ellipse at 65% 55%, color-mix(in srgb, var(--color-glow-500) 8%, transparent) 0%, transparent 55%)',
            }}
          >
            <p className="mb-[0.5%] text-[1.4vw] uppercase tracking-[0.3em] text-muted">{venue?.name}</p>
            <h1
              className="mb-[0.5%] text-center text-[5.2vw] font-bold leading-tight text-ink"
              style={{ textShadow: '0 0 60px color-mix(in srgb, var(--color-brand-500) 30%, transparent)' }}
            >
              Just Go Karaokê
            </h1>
            <p className="mb-[4%] font-mono text-[1.7vw] tracking-[0.3em] text-brand-400">
              Sessão · {session?.code}
            </p>

            <div className="mb-[3%] flex flex-col items-center">
              <div className="animate-neon-pulse mb-[2%] rounded-2xl border-2 border-brand-500/45 bg-brand-500/10 p-[1.5%]">
                <QrCode value={joinUrl} size={220} />
              </div>
              <p className="text-center text-[2vw] font-bold text-ink">Aponte a câmera e entre na roda!</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
              <span className="font-mono text-[1.1vw] text-muted">
                {participantCount} participante{participantCount === 1 ? '' : 's'} conectado
                {participantCount === 1 ? '' : 's'}
              </span>
            </div>

            {upNext.length > 0 && (
              <div className="mt-[4%] w-full max-w-[50%]">
                <p className="mb-[1%] text-center text-[0.95vw] uppercase tracking-[0.2em] text-muted">
                  A seguir
                </p>
                <ol className="flex flex-col gap-[0.6%]">
                  {upNext.slice(0, 3).map((entry, index) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-stage-700 bg-stage-800/70 px-[3%] py-[1.2%] text-[1vw]"
                    >
                      <span className="text-muted">{index + 1}</span>
                      <span className="flex-1 truncate text-ink">{entry.songQuery}</span>
                      <span className="text-muted">{entry.performerName}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {ctaVisible && ctaContent && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
            <div
              className="animate-score-reveal rounded-3xl px-[6%] py-[4%] text-center"
              style={{
                background: `radial-gradient(ellipse, color-mix(in srgb, ${ctaContent.color} 28%, transparent), transparent)`,
                border: `3px solid ${ctaContent.color}`,
                boxShadow: `0 0 80px color-mix(in srgb, ${ctaContent.color} 55%, transparent)`,
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
            >
              <p
                className="mb-[1%] font-bold leading-tight"
                style={{ color: ctaContent.color, fontSize: '4vw', textShadow: `0 0 40px ${ctaContent.color}` }}
              >
                {ctaContent.title}
              </p>
              <p className="text-[1.6vw] text-ink">{ctaContent.subtitle}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
