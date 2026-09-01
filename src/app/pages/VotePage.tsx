import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import {
  getVotingPerformance,
  subscribeToPerformances,
  type QueueEntry,
} from '@/data/performances';
import { getMyVote, getResults, submitVote, type PerformanceResult } from '@/data/votes';
import { SCORE_CATEGORIES, VOTING_WINDOW_SECONDS, type ScoreCategory } from '@/domain/voting/rules';
import { readActiveSession } from '@/lib/active-session';

const CATEGORY_LABEL: Record<ScoreCategory, string> = {
  voice: 'Voz',
  performance: 'Performance',
  charisma: 'Carisma',
  fun: 'Diversão',
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
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Voltar
        </Link>
      </main>
    );
  }

  const remaining = performance ? secondsLeft(performance.votingStartedAt) : 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>
      <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        Votação
      </h1>

      {errorMessage && <p className="text-sm text-glow-400">{errorMessage}</p>}

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
        <div className="flex w-full flex-col gap-4">
          <p className="text-ink">
            {performance.performerName} — {performance.songQuery}
          </p>
          <p className="text-sm text-brand-400">{remaining}s restantes</p>

          {remaining === 0 ? (
            <p className="text-muted">A janela de votação fechou.</p>
          ) : (
            <>
              {SCORE_CATEGORIES.map((category) => (
                <div key={category} className="flex flex-col gap-2">
                  <p className="text-sm text-muted">{CATEGORY_LABEL[category]}</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setScores((prev) => ({ ...prev, [category]: n }))}
                        className={`h-10 w-10 rounded-full text-sm font-medium transition-colors ${
                          scores[category] >= n
                            ? 'bg-brand-500 text-stage-950'
                            : 'bg-stage-800 text-muted hover:text-ink'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={() => setWouldSingAlong((v) => !v)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  wouldSingAlong ? 'bg-brand-500 text-stage-950' : 'bg-stage-800 text-muted'
                }`}
              >
                🫶 Eu cantaria junto {wouldSingAlong ? '✓' : ''}
              </button>

              <Button
                size="lg"
                disabled={submitting || SCORE_CATEGORIES.some((c) => scores[c] === 0)}
                onClick={handleSubmit}
              >
                {submitting ? 'Enviando…' : 'Votar'}
              </Button>
            </>
          )}
        </div>
      )}

      {performance && !performance.isMine && performance.status === 'VOTING' && alreadyVoted && (
        <p className="text-muted">Voto registrado! Aguardando o resultado…</p>
      )}

      {performance && performance.status === 'RESULT' && results && (
        <div className="flex w-full flex-col gap-3 rounded-card border border-brand-500 bg-stage-800 p-5">
          <p className="text-ink">
            {performance.performerName} — {performance.songQuery}
          </p>
          <p className="text-5xl font-bold text-brand-400">{results.audience_score}</p>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Nota da Plateia</p>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted">
            <p>Voz: {results.voice_avg}</p>
            <p>Performance: {results.performance_avg}</p>
            <p>Carisma: {results.charisma_avg}</p>
            <p>Diversão: {results.fun_avg}</p>
          </div>
          <p className="text-sm text-muted">
            🫶 {results.sing_along_percent}% cantariam junto · {results.vote_count} votos
          </p>
        </div>
      )}

      <Link to="/queue" className="text-sm text-muted hover:text-ink">
        ← Voltar para a fila
      </Link>
    </main>
  );
}
