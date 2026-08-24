import { Link } from 'react-router-dom';
import { isSupabaseConfigured } from '@/lib/supabase';

interface PlaceholderPageProps {
  /** Rótulo da experiência (Participante / Host / Telão) */
  scope: string;
  title: string;
  /** Fase do roadmap em que esta tela será implementada */
  phase: string;
}

/**
 * Tela temporária para rotas ainda não implementadas.
 * Deixa explícito em qual fatia do roadmap cada área será construída.
 */
export function PlaceholderPage({ scope, title, phase }: PlaceholderPageProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">{scope}</p>
      <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        {title}
      </h1>
      <div className="rounded-card border border-stage-700 bg-stage-800 px-5 py-4 text-sm text-muted">
        Em construção — {phase}.
        <br />
        Backend Supabase: {isSupabaseConfigured ? '✅ configurado' : '⚠️ não configurado'}
      </div>
      <Link to="/" className="text-sm text-muted hover:text-ink">
        ← Voltar
      </Link>
    </main>
  );
}
