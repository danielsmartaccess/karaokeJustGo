import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { getSessionByCode, recordSessionParticipation, type Session } from '@/data/sessions';
import { upsertMyProfile, getVenueById, type Venue } from '@/data/identity';
import { isOpenForParticipants } from '@/domain/session/state-machine';
import { setActiveSession } from '@/lib/active-session';

type Step = 'code' | 'checking' | 'not-found' | 'not-open' | 'profile' | 'joining' | 'joined' | 'error';

/**
 * Fluxo de entrada do participante (FASE 3): código/QR → validar sessão → cadastro
 * mínimo (nome + WhatsApp) → sessão anônima (Supabase Auth). Ver docs/PRODUCT.md.
 */
export function JoinPage() {
  const { code: codeParam } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('code');
  const [codeInput, setCodeInput] = useState(codeParam?.toUpperCase() ?? '');
  const [session, setSession] = useState<Session | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (codeParam) void lookupCode(codeParam);
  }, [codeParam]);

  async function lookupCode(code: string) {
    setStep('checking');
    setErrorMessage('');
    try {
      const found = await getSessionByCode(code);
      if (!found) {
        setStep('not-found');
        return;
      }
      setSession(found);
      setVenue(await getVenueById(found.venue_id));
      setStep(isOpenForParticipants(found.status) ? 'profile' : 'not-open');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao buscar a sessão.');
      setStep('error');
    }
  }

  function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) return;
    navigate(`/join/${code}`);
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session || !displayName.trim() || !whatsapp.trim()) return;
    setStep('joining');
    setErrorMessage('');
    try {
      await upsertMyProfile({ displayName: displayName.trim(), whatsapp: whatsapp.trim() });
      await recordSessionParticipation(session.id);
      setActiveSession({ id: session.id, code: session.code });
      setStep('joined');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível entrar na sessão.');
      setStep('error');
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 py-12">
      <div className="glass-bright w-full animate-fade-in-up rounded-card p-8 text-center">
        {step === 'code' && (
          <>
            <div className="mb-5 text-5xl">🎤</div>
            <h1 className="mb-1 text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              Entrar na sessão
            </h1>
            <p className="mb-6 text-sm text-muted">Digite o código de 6 dígitos mostrado no telão ou no QR.</p>
            <form onSubmit={handleCodeSubmit} className="flex w-full flex-col gap-3">
              <Input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="CÓDIGO"
                maxLength={6}
                autoFocus
                className="text-center font-mono text-2xl font-bold uppercase tracking-[0.35em]"
              />
              <Button type="submit" size="lg" disabled={codeInput.trim().length < 4}>
                Continuar
              </Button>
            </form>
          </>
        )}

        {step === 'checking' && <p className="py-8 text-muted">Procurando sessão…</p>}

        {step === 'not-found' && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-ink">Código não encontrado</h1>
            <p className="mb-6 text-muted">Confira o código e tente de novo.</p>
            <Button onClick={() => navigate('/join')} className="w-full">
              Tentar outro código
            </Button>
          </>
        )}

        {step === 'not-open' && session && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-ink">
              {session.status === 'SCHEDULED' ? 'Sessão ainda não abriu' : 'Sessão encerrada'}
            </h1>
            <p className="mb-6 text-muted">
              {venue?.name ?? 'Esta sessão'}
              {session.status === 'SCHEDULED'
                ? ' ainda não está aberta para entrada. Aguarde o host abrir.'
                : ' já foi encerrada.'}
            </p>
            <Button onClick={() => navigate('/join')} className="w-full">
              Tentar outro código
            </Button>
          </>
        )}

        {(step === 'profile' || step === 'joining') && session && (
          <>
            <div className="mb-4 text-4xl">🎉</div>
            <h1 className="mb-1 text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              {venue?.name ?? 'Sessão'}
            </h1>
            <p className="mb-6 text-sm text-muted">
              Sessão <span className="font-mono text-brand-400">{session.code}</span> · cadastro rápido
            </p>
            <form onSubmit={handleProfileSubmit} className="flex w-full flex-col gap-3">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome"
                autoFocus
                disabled={step === 'joining'}
              />
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="WhatsApp"
                type="tel"
                disabled={step === 'joining'}
              />
              <Button
                type="submit"
                size="lg"
                disabled={step === 'joining' || !displayName.trim() || !whatsapp.trim()}
              >
                {step === 'joining' ? 'Entrando…' : 'Vamos nessa!'}
              </Button>
            </form>
          </>
        )}

        {step === 'joined' && (
          <div className="flex flex-col items-center gap-3">
            <p className="animate-score-reveal text-5xl">🎉</p>
            <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              Você entrou na sessão!
            </h1>
            <p className="text-muted">
              {venue?.name}
              {session?.code ? (
                <>
                  {' · código '}
                  <span className="font-mono text-brand-400">{session.code}</span>
                </>
              ) : (
                ''
              )}
            </p>
            <Link to="/songs" className="mt-2 w-full">
              <Button size="lg" className="w-full">
                Buscar música
              </Button>
            </Link>
          </div>
        )}

        {step === 'error' && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-ink">Algo deu errado</h1>
            <p className="mb-6 text-glow-400">{errorMessage}</p>
            <Button onClick={() => setStep('code')} className="w-full">
              Tentar de novo
            </Button>
          </>
        )}
      </div>

      {step === 'code' && (
        <p className="text-center text-xs text-muted">ou escaneie o QR Code no telão</p>
      )}

      <Link to="/" className="text-sm text-muted hover:text-ink">
        ← Voltar
      </Link>
    </main>
  );
}
