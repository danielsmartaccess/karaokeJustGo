import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { getSessionByCode, type Session } from '@/data/sessions';
import { getVenueById, type Venue } from '@/data/identity';
import {
  getCurrentPerformance,
  getQueue,
  getVotingPerformance,
  subscribeToPerformances,
  type QueueEntry,
} from '@/data/performances';
import { getResults, type PerformanceResult } from '@/data/votes';
import { VOTING_WINDOW_SECONDS } from '@/domain/voting/rules';
import goMark from '@/assets/go-mark-blue.png';

function secondsLeft(votingStartedAt: string | null): number {
  if (!votingStartedAt) return 0;
  const elapsed = (Date.now() - new Date(votingStartedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(VOTING_WINDOW_SECONDS - elapsed));
}

/**
 * Telão (FASE 6): tela pública, só leitura, para o venue projetar. Mostra quem está
 * cantando agora, a votação em andamento e o resultado, tudo em tempo real (Realtime).
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
  const [loading, setLoading] = useState(Boolean(codeParam));
  const [errorMessage, setErrorMessage] = useState('');
  const [, setTick] = useState(0);

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
        unsubscribe = subscribeToPerformances(found.id, () => void refresh(found.id));
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

    void load();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [codeParam]);

  useEffect(() => {
    if (voting?.status !== 'VOTING') return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [voting?.status]);

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

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-10 px-8 py-16 text-center">
      <div className="flex flex-col items-center gap-2">
        <img src={goMark} alt="" className="h-8 w-auto" />
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-brand-400">
          {venue?.name} · {session?.code}
        </p>
      </div>

      {voting ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg text-muted">
            {voting.status === 'VOTING' ? '🗳️ Votação aberta' : '🏆 Resultado'}
          </p>
          <h1
            className="text-6xl font-bold text-brand-400"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {voting.performerName}
          </h1>
          <p className="text-2xl text-ink">
            {voting.song?.title} <span className="text-muted">— {voting.song?.artist}</span>
          </p>
          {voting.status === 'VOTING' && (
            <p className="text-4xl font-bold text-ink">{secondsLeft(voting.votingStartedAt)}s</p>
          )}
          {voting.status === 'RESULT' && results && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-7xl font-bold text-ink">{results.audience_score}</p>
              <p className="text-sm uppercase tracking-[0.2em] text-muted">Nota da Plateia</p>
              <p className="text-lg text-muted">
                🫶 {results.sing_along_percent}% cantariam junto · {results.vote_count} votos
              </p>
            </div>
          )}
        </div>
      ) : current ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg text-muted">
            {current.status === 'PERFORMING' ? '🎤 No palco agora' : 'Preparando…'}
          </p>
          <h1
            className="text-6xl font-bold text-brand-400"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {current.performerName}
          </h1>
          <p className="text-3xl text-ink">
            {current.song?.title} <span className="text-muted">— {current.song?.artist}</span>
          </p>
        </div>
      ) : (
        <p className="text-2xl text-muted">Aguardando o próximo cantor…</p>
      )}

      {upNext.length > 0 && (
        <div className="w-full">
          <p className="mb-3 text-sm uppercase tracking-[0.2em] text-muted">A seguir</p>
          <ol className="flex flex-col gap-2">
            {upNext.map((entry, index) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-card border border-stage-700 bg-stage-800 px-5 py-3 text-left"
              >
                <span className="text-muted">{index + 1}</span>
                <span className="flex-1 text-ink">{entry.song?.title}</span>
                <span className="text-muted">{entry.performerName}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </main>
  );
}
