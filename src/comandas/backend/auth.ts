import { getSupabase } from '../../lib/supabase';
import type { DemoControls } from './demoBackend';

/**
 * Login da EQUIPE (garçom e gerente). O cliente não tem conta.
 *
 * Ao vivo: Supabase Auth com e-mail e senha (nunca login anônimo: o banco recusa
 * quem entrou assim). Na demonstração: escolher um nome, sem senha.
 */
export interface StaffAuth {
  readonly mode: 'live' | 'demo';
  signedIn(): Promise<boolean>;
  /** Nome informado no cadastro (usado para registrar a equipe na primeira entrada). */
  profileName(): Promise<string | undefined>;
  subscribe(listener: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** `confirmEmail`: o Supabase exige confirmar o e-mail antes de a conta entrar. */
  signUp(email: string, password: string, name: string): Promise<{ confirmEmail: boolean }>;
  signOut(): Promise<void>;
  /** Só na demonstração. */
  demo?: DemoControls;
}

export class AuthError extends Error {}

/** Mensagens do Supabase Auth em português, sem vazar detalhe técnico. */
export function authMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed'))
    return 'Confirme seu e-mail pelo link que enviamos e tente de novo.';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Este e-mail já tem cadastro. Use "Entrar".';
  }
  if (
    m.includes('password') &&
    (m.includes('weak') || m.includes('short') || m.includes('least'))
  ) {
    return 'Senha fraca ou curta demais. Use pelo menos 8 caracteres.';
  }
  if (m.includes('pwned') || m.includes('compromised') || m.includes('leaked')) {
    return 'Esta senha apareceu em vazamentos conhecidos. Escolha outra.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Muitas tentativas. Espere um pouco e tente de novo.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Sem conexão. Verifique a internet e tente de novo.';
  }
  return 'Não foi possível entrar agora. Tente de novo.';
}

export function createLiveAuth(): StaffAuth {
  const auth = () => getSupabase().auth;
  return {
    mode: 'live',
    async signedIn() {
      const { data } = await auth().getSession();
      return data.session !== null;
    },
    async profileName() {
      const { data } = await auth().getUser();
      const name = data.user?.user_metadata?.name;
      return typeof name === 'string' && name.trim() !== '' ? name.trim() : undefined;
    },
    subscribe(listener) {
      const { data } = auth().onAuthStateChange(() => listener());
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await auth().signInWithPassword({ email: email.trim(), password });
      if (error) throw new AuthError(authMessage(error.message));
    },
    async signUp(email, password, name) {
      const { data, error } = await auth().signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) throw new AuthError(authMessage(error.message));
      return { confirmEmail: data.session === null };
    },
    async signOut() {
      await auth().signOut();
    },
  };
}

export function createDemoAuth(demo: DemoControls): StaffAuth {
  const listeners = new Set<() => void>();
  return {
    mode: 'demo',
    demo,
    async signedIn() {
      return demo.staffId() !== null;
    },
    async profileName() {
      return demo.staff().find((s) => s.id === demo.staffId())?.name;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signIn() {
      // A demonstração entra escolhendo um nome (ver StaffGate), não por senha.
    },
    async signUp() {
      return { confirmEmail: false };
    },
    async signOut() {
      demo.signInAs(null);
      listeners.forEach((l) => l());
    },
  };
}
