import { Link } from 'react-router-dom';
import { Button } from '@/ui/Button';

/**
 * Home do participante (mobile-first). Ponto de entrada após o QR Code.
 * FASE 1: estrutura e identidade. As funcionalidades entram nas fatias seguintes.
 */
export function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-400">Just Go</p>
        <h1
          className="text-5xl font-bold leading-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          🎤 Karaokê
        </h1>
        <p className="text-balance text-muted">
          Cante, vote e faça parte da noite. A experiência social do karaokê no Armazém Anita.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Link to="/join" className="w-full">
          <Button size="lg" className="w-full">
            Entrar na sessão
          </Button>
        </Link>
        <Link to="/display" className="w-full">
          <Button size="md" variant="outline" className="w-full">
            Ver o telão
          </Button>
        </Link>
      </div>

      <footer className="mt-8 text-xs text-muted">
        <Link to="/host" className="hover:text-ink">
          Sou o host
        </Link>
      </footer>
    </main>
  );
}
