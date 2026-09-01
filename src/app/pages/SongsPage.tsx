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

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-6 py-12">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Pedir música
        </h1>
        {activeSession ? (
          <p className="text-sm text-muted">Sessão {activeSession.code}</p>
        ) : (
          <p className="text-sm text-muted">
            Você ainda não entrou em uma sessão —{' '}
            <Link to="/join" className="text-brand-400 hover:text-brand-300">
              entrar agora
            </Link>
            .
          </p>
        )}
      </div>

      {activeSession && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: Evidências — Chitãozinho e Xororó"
            autoFocus
            maxLength={120}
          />
          <p className="text-xs text-muted">
            Escreva a música e, se quiser, o artista. O host acha o vídeo de karaokê e joga no
            telão quando te chamar.
          </p>
          <Button type="submit" size="lg" disabled={submitting || !query.trim()}>
            {submitting ? 'Entrando…' : 'Entrar na fila'}
          </Button>
        </form>
      )}

      {errorMessage && <p className="text-center text-sm text-glow-400">{errorMessage}</p>}

      {activeSession && (
        <Link to="/queue" className="text-center text-sm text-brand-400 hover:text-brand-300">
          Ver fila →
        </Link>
      )}

      <Link to="/" className="text-center text-sm text-muted hover:text-ink">
        ← Voltar
      </Link>
    </main>
  );
}
