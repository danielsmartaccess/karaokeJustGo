import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { getSessionByCode, type Session } from '@/data/sessions';
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
      setActiveSession({ id: session.id, code: session.code });
      setStep('joined');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível entrar na sessão.');
      setStep('error');
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>

      {step === 'code' && (
        <>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Entrar na sessão
          </h1>
          <p className="text-muted">Digite o código de 6 dígitos mostrado no telão ou no QR.</p>
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
              Continuar
            </Button>
          </form>
        </>
      )}

      {step === 'checking' && <p className="text-muted">Procurando sessão…</p>}

      {step === 'not-found' && (
        <>
          <h1 className="text-2xl font-bold">Código não encontrado</h1>
          <p className="text-muted">Confira o código e tente de novo.</p>
          <Button onClick={() => navigate('/join')}>Tentar outro código</Button>
        </>
      )}

      {step === 'not-open' && session && (
        <>
          <h1 className="text-2xl font-bold">
            {session.status === 'SCHEDULED' ? 'Sessão ainda não abriu' : 'Sessão encerrada'}
          </h1>
          <p className="text-muted">
            {venue?.name ?? 'Esta sessão'}
            {session.status === 'SCHEDULED'
              ? ' ainda não está aberta para entrada. Aguarde o host abrir.'
              : ' já foi encerrada.'}
          </p>
          <Button onClick={() => navigate('/join')}>Tentar outro código</Button>
        </>
      )}

      {(step === 'profile' || step === 'joining') && session && (
        <>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {venue?.name ?? 'Sessão'}
          </h1>
          <p className="text-muted">Cadastro rápido — só o essencial para participar.</p>
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
              {step === 'joining' ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </>
      )}

      {step === 'joined' && (
        <>
          <p className="text-4xl">🎉</p>
          <h1 className="text-2xl font-bold">Você entrou na sessão!</h1>
          <p className="text-muted">
            {venue?.name}
            {session?.code ? ` · código ${session.code}` : ''}
          </p>
          <Link to="/songs" className="w-full">
            <Button size="lg" className="w-full">
              Buscar música
            </Button>
          </Link>
        </>
      )}

      {step === 'error' && (
        <>
          <h1 className="text-2xl font-bold">Algo deu errado</h1>
          <p className="text-muted">{errorMessage}</p>
          <Button onClick={() => setStep('code')}>Tentar de novo</Button>
        </>
      )}

      <Link to="/" className="text-sm text-muted hover:text-ink">
        ← Voltar
      </Link>
    </main>
  );
}
