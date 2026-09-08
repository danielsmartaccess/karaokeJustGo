import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { joinQueue } from '@/data/performances';
import { readActiveSession, type ActiveSession } from '@/lib/active-session';

/**
 * Pedido de música (FASE 10): sem catálogo. O participante digita o que quer cantar
 * em texto livre e entra na fila; o vídeo de karaokê é resolvido pelo host no telão
 * na hora de chamar (docs/PRODUCT.md — "o karaokê é o contexto, não o produto").
 */
export function SongsPage() {
  const navigate = useNavigate();
  const [activeSession] = useState<ActiveSession | null>(readActiveSession);
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!activeSession || !query.trim()) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      await joinQueue(activeSession.id, query);
      navigate('/queue');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível entrar na fila.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!activeSession) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>
        <h1 className="text-2xl font-bold">Pedir música</h1>
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 py-12">
      <div className="glass-bright w-full animate-fade-in-up rounded-card p-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="text-3xl">🎵</span>
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              Pedir música
            </h1>
            <p className="text-sm text-muted">
              Sessão <span className="font-mono text-brand-400">{activeSession.code}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-xs uppercase tracking-[0.15em] text-muted">
            Qual música você quer cantar?
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: Evidências — Chitãozinho e Xororó"
            autoFocus
            maxLength={120}
          />
          <p className="text-xs text-muted">
            Escreva a música e, se quiser, o artista. O host acha o vídeo de karaokê e joga no
            telão quando te chamar — qualquer música, não há catálogo!
          </p>
          <Button type="submit" size="lg" disabled={submitting || !query.trim()}>
            {submitting ? 'Entrando…' : 'Entrar na fila'}
          </Button>
        </form>

        {errorMessage && <p className="mt-3 text-center text-sm text-glow-400">{errorMessage}</p>}
      </div>
    </main>
  );
}
