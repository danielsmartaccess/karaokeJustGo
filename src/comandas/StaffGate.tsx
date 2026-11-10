import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AuthError } from './backend/auth';
import { useEnv, useQuery } from './backend/hooks';
import type { StaffRole } from './backend/types';
import { ComandaShell, type Papel } from './ComandaShell';
import { cardClass, ghostButton, inputClass, primaryButton, primaryStyle } from './ui';

export interface StaffSession {
  name: string;
  role: StaffRole;
  signOut: () => Promise<void>;
}

type Session = { state: 'out' } | { state: 'in'; name: string; role: StaffRole; active: boolean };

/**
 * Porta das telas da equipe. Ao vivo: e-mail e senha (cadastro novo entra PENDENTE
 * até o gerente ativar). Na demonstração: escolher um nome. Só entrega as telas a
 * quem está ativo e tem o papel certo; o banco confere tudo de novo a cada chamada.
 */
export function StaffGate({
  papel,
  titulo,
  children,
}: {
  papel: 'garcom' | 'gerente';
  titulo: string;
  children: (staff: StaffSession) => ReactNode;
}) {
  const { auth, backend } = useEnv();

  const session = useQuery<Session>(
    async () => {
      if (!(await auth.signedIn())) return { state: 'out' };
      let who = await backend.whoami();
      if (!who.registered) {
        // Primeira entrada: registra a pessoa (pendente até o gerente ativar).
        who = await backend.registerStaff((await auth.profileName()) ?? 'Equipe');
      }
      if (!who.registered || !who.role) return { state: 'out' };
      return { state: 'in', name: who.name ?? '', role: who.role, active: who.active === true };
    },
    [],
    { every: 15000 },
  );
  const reload = session.reload;
  useEffect(() => auth.subscribe(() => void reload()), [auth, reload]);

  const signOut = async () => {
    await auth.signOut();
    await reload();
  };

  const s = session.data;
  if (!s) {
    return (
      <ComandaShell papel={papel} titulo={titulo}>
        <p className="text-slate-500 text-sm">
          {session.error
            ? 'Não foi possível verificar o seu acesso. Recarregue a página.'
            : 'Carregando…'}
        </p>
      </ComandaShell>
    );
  }

  if (s.state === 'out') {
    return (
      <ComandaShell papel={papel} titulo={titulo}>
        {auth.mode === 'demo' ? (
          <DemoPicker papel={papel} onDone={reload} />
        ) : (
          <LoginForm onDone={reload} />
        )}
      </ComandaShell>
    );
  }

  const sair = (
    <button onClick={() => void signOut()} className={ghostButton}>
      Sair
    </button>
  );

  if (!s.active) {
    return (
      <ComandaShell papel={papel} titulo={titulo} direita={sair}>
        <div className={cardClass} data-testid="acesso-pendente">
          <p className="text-slate-200 font-semibold mb-1">Aguardando aprovação</p>
          <p className="text-slate-400 text-sm">
            Seu cadastro foi recebido. O gerente precisa ativar o seu acesso antes de você ver as
            comandas. Quando ele ativar, esta tela atualiza sozinha.
          </p>
        </div>
      </ComandaShell>
    );
  }

  if (papel === 'gerente' && s.role !== 'gerente') {
    // Na demonstração dá para trocar de pessoa; ao vivo, só o gerente muda o papel de alguém.
    if (auth.mode === 'demo') {
      return (
        <ComandaShell papel={papel} titulo={titulo}>
          <DemoPicker papel={papel} onDone={reload} />
        </ComandaShell>
      );
    }
    return (
      <ComandaShell papel={papel} titulo={titulo} direita={sair}>
        <div className={cardClass}>
          <p className="text-slate-400 text-sm">
            Esta tela é só para gerentes. Peça ao gerente para mudar o seu papel, ou use a tela do
            garçom.
          </p>
        </div>
      </ComandaShell>
    );
  }

  return <>{children({ name: s.name, role: s.role, signOut })}</>;
}

/** Demonstração: escolhe quem você é. Na versão real, e-mail e senha. */
function DemoPicker({ papel, onDone }: { papel: Papel; onDone: () => Promise<void> }) {
  const { auth } = useEnv();
  const role: StaffRole = papel === 'gerente' ? 'gerente' : 'garcom';
  const pessoas = (auth.demo?.staff() ?? []).filter((p) => p.role === role);
  const visiveis = role === 'gerente' ? pessoas.filter((p) => p.active) : pessoas;

  return (
    <div className={cardClass}>
      <p className="text-slate-400 text-sm mb-4">
        {role === 'gerente'
          ? 'Na versão real, o gerente entra com e-mail e senha, no celular ou no computador. Aqui, escolha quem você é:'
          : 'Na versão real, o garçom entra com e-mail e senha e o gerente ativa o acesso. Aqui, escolha quem você é:'}
      </p>
      <div className="space-y-2">
        {visiveis.map((p) =>
          p.active ? (
            <button
              key={p.id}
              onClick={() => {
                auth.demo?.signInAs(p.id);
                void onDone();
              }}
              className={`${primaryButton} w-full`}
              style={primaryStyle}
            >
              Entrar como {p.name}
            </button>
          ) : (
            <div
              key={p.id}
              className="px-4 py-3 rounded-xl border border-slate-800 text-slate-500 text-sm"
            >
              {p.name}: aguardando o gerente ativar o acesso
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/** Ao vivo: entrar ou criar conta (a conta nova fica pendente até o gerente ativar). */
function LoginForm({ onDone }: { onDone: () => Promise<void> }) {
  const { auth } = useEnv();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setAviso('');
    setEnviando(true);
    try {
      if (criando) {
        if (nome.trim() === '') {
          setErro('Informe o seu nome.');
          return;
        }
        const r = await auth.signUp(email, senha, nome);
        if (r.confirmEmail) {
          setAviso(
            'Enviamos um e-mail de confirmação. Abra o link e depois entre. O gerente também precisa ativar o seu acesso.',
          );
          setCriando(false);
          return;
        }
      } else {
        await auth.signIn(email, senha);
      }
      await onDone();
    } catch (err) {
      setErro(
        err instanceof AuthError ? err.message : 'Não foi possível entrar agora. Tente de novo.',
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className={cardClass} data-testid="login-equipe">
      <p className="text-slate-400 text-sm mb-4">
        {criando
          ? 'Crie o seu acesso. O gerente precisa ativá-lo antes de você ver as comandas.'
          : 'Entre com o e-mail e a senha da equipe.'}
      </p>
      <div className="space-y-3">
        {criando && (
          <label className="block">
            <span className="block text-slate-400 text-sm mb-1.5">Nome</span>
            <input
              className={inputClass}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}
        <label className="block">
          <span className="block text-slate-400 text-sm mb-1.5">E-mail</span>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="block">
          <span className="block text-slate-400 text-sm mb-1.5">Senha</span>
          <input
            type="password"
            className={inputClass}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={criando ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
        </label>
        {erro && (
          <p role="alert" className="text-red-400 text-sm">
            {erro}
          </p>
        )}
        {aviso && (
          <p role="status" className="text-green-400 text-sm">
            {aviso}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando}
          className={`${primaryButton} w-full`}
          style={primaryStyle}
        >
          {criando ? 'Criar acesso' : 'Entrar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setCriando(!criando);
            setErro('');
          }}
          className="w-full text-sm text-slate-400 underline"
        >
          {criando ? 'Já tenho acesso: entrar' : 'Primeiro acesso: criar conta'}
        </button>
      </div>
    </form>
  );
}
