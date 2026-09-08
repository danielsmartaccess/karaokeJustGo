import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import { cn } from '@/lib/utils';
import {
  getVotingPerformance,
  subscribeToPerformances,
  type QueueEntry,
} from '@/data/performances';
import { getMyVote, getResults, submitVote, type PerformanceResult } from '@/data/votes';
import { SCORE_CATEGORIES, VOTING_WINDOW_SECONDS, type ScoreCategory } from '@/domain/voting/rules';
import { readActiveSession } from '@/lib/active-session';

const CATEGORY_LABEL: Record<ScoreCategory, { label: string; icon: string }> = {
  voice: { label: 'Voz', icon: '🎤' },
  performance: { label: 'Performance', icon: '🎭' },
  charisma: { label: 'Carisma', icon: '✨' },
  fun: { label: 'Diversão', icon: '🎉' },
};

function secondsLeft(votingStartedAt: string | null): number {
  if (!votingStartedAt) return 0;
  const elapsed = (Date.now() - new Date(votingStartedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(VOTING_WINDOW_SECONDS - elapsed));
}

/**
 * Votação (FASE 7): 60s, 4 categorias (1-5) + "eu cantaria junto". A janela e as
 * regras de elegibilidade são guiadas por src/domain/voting/rules.ts, mas a fonte de
 * verdade é o trigger `validate_vote` no servidor (docs/SECURITY.md).
 */
export function VotePage() {
  const [activeSession] = useState(readActiveSession);
  const [performance, setPerformance] = useState<QueueEntry | null>(null);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [results, setResults] = useState<PerformanceResult | null>(null);
  const [scores, setScores] = useState<Record<ScoreCategory, number>>({
    voice: 0,
    performance: 0,
    charisma: 0,
    fun: 0,
  });
  const [wouldSingAlong, setWouldSingAlong] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!activeSession) {
      setLoading(false);
      return;
    }
    setErrorMessage('');
    try {
      const current = await getVotingPerformance(activeSession.id);
      setPerformance(current);
      if (current && !current.isMine) {
        if (current.status === 'VOTING') {
          setAlreadyVoted(Boolean(await getMyVote(current.id)));
        }
        if (current.status === 'RESULT') {
          setResults(await getResults(current.id));
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar a votação.');
    } finally {
      setLoading(false);
    }
  }, [activeSession]);

  useEffect(() => {
    void load();
    if (!activeSession) return;
    return subscribeToPerformances(activeSession.id, () => void load());
  }, [activeSession, load]);

  // Recalcula o tempo restante a cada segundo enquanto a votação está aberta.
  useEffect(() => {
    if (performance?.status !== 'VOTING') return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [performance?.status]);

  async function handleSubmit() {
    if (!performance) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      await submitVote(performance.id, { scores, wouldSingAlong });
      setAlreadyVoted(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível registrar o voto.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!activeSession) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>
        <h1 className="text-2xl font-bold">Votação</h1>
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

  const remaining = performance ? secondsLeft(performance.votingStartedAt) : 0;
  const allRated = SCORE_CATEGORIES.every((c) => scores[c] > 0);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 py-10">
      <div className="glass-bright w-full animate-fade-in-up rounded-card p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>
        <h1 className="mb-4 text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
          Votação
        </h1>

        {errorMessage && <p className="mb-3 text-sm text-glow-400">{errorMessage}</p>}
        {loading && <p className="text-muted">Carregando…</p>}

        {!loading && !performance && (
          <p className="text-muted">
            Nenhuma votação em andamento agora —{' '}
            <Link to="/queue" className="text-brand-400 hover:text-brand-300">
              ver a fila
            </Link>
            .
          </p>
        )}

        {performance?.isMine && (
          <p className="text-muted">🎤 Você está sendo avaliado agora! Aguarde o resultado.</p>
        )}

        {performance && !performance.isMine && performance.status === 'VOTING' && !alreadyVoted && (
          <div className="flex w-full flex-col gap-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-ink">
                {performance.performerName} — {performance.songQuery}
              </p>
              <span
                className={cn(
                  'shrink-0 rounded-lg border border-glow-500/40 px-2 py-1 font-mono text-sm font-bold text-glow-400',
                  remaining <= 10 && 'animate-neon-pulse-glow',
                )}
              >
                {remaining}s
              </span>
            </div>

            {remaining === 0 ? (
              <p className="text-center text-muted">A janela de votação fechou.</p>
            ) : (
              <>
                {SCORE_CATEGORIES.map((category) => (
                  <div key={category} className="flex flex-col gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <span>{CATEGORY_LABEL[category].icon}</span>
                      {CATEGORY_LABEL[category].label}
                    </p>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setScores((prev) => ({ ...prev, [category]: n }))}
                          className={cn(
                            'h-11 w-11 rounded-xl border-2 font-mono text-base font-bold transition-all hover:scale-110 active:scale-95',
                            scores[category] >= n
                              ? 'border-brand-500 bg-brand-500/25 text-brand-400'
                              : 'border-stage-700 bg-stage-800 text-muted',
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setWouldSingAlong((v) => !v)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 transition-all',
                    wouldSingAlong
                      ? 'border-brand-400/50 bg-brand-400/10'
                      : 'border-stage-700 bg-stage-800',
                  )}
                >
                  <span className="font-semibold text-ink">🫶 Eu cantaria junto</span>
                  <span
                    className="relative h-6 w-11 rounded-full transition-colors"
                    style={{ background: wouldSingAlong ? 'var(--color-brand-500)' : 'var(--color-stage-700)' }}
                  >
                    <span
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
                      style={{ left: wouldSingAlong ? '22px' : '2px' }}
                    />
                  </span>
                </button>

                <Button size="lg" disabled={submitting || !allRated} onClick={handleSubmit}>
                  {submitting ? 'Enviando…' : allRated ? 'Votar' : 'Avalie todas as categorias'}
                </Button>
              </>
            )}
          </div>
        )}

        {performance && !performance.isMine && performance.status === 'VOTING' && alreadyVoted && (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="animate-score-reveal text-4xl">✅</p>
            <p className="text-muted">Voto registrado! Aguardando o resultado…</p>
          </div>
        )}

        {performance && performance.status === 'RESULT' && results && (
          <div className="flex w-full flex-col gap-3 rounded-card border border-brand-500/40 bg-stage-800 p-5">
            <p className="text-ink">
              {performance.performerName} — {performance.songQuery}
            </p>
            <p className="font-mono text-5xl font-bold text-brand-400">{results.audience_score ?? '—'}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Nota da Plateia</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-muted">
              <p>🎤 Voz: {results.voice_avg ?? '—'}</p>
              <p>🎭 Performance: {results.performance_avg ?? '—'}</p>
              <p>✨ Carisma: {results.charisma_avg ?? '—'}</p>
              <p>🎉 Diversão: {results.fun_avg ?? '—'}</p>
            </div>
            <p className="text-sm text-muted">
              🫶 {results.sing_along_percent ?? 0}% cantariam junto · {results.vote_count ?? 0} votos
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
