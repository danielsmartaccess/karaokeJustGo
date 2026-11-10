import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { createDemoAuth, createLiveAuth, type StaffAuth } from './auth';
import { createDemoBackend } from './demoBackend';
import { createSupabaseBackend, type Rpc } from './supabaseBackend';
import type { ComandaBackend } from './types';

export interface ComandaEnv {
  backend: ComandaBackend;
  auth: StaffAuth;
}

/**
 * O modo ao vivo precisa de DUAS coisas: Supabase configurado E o interruptor
 * VITE_COMANDAS_LIVE=true. O interruptor existe para que nenhuma implantação passe
 * a chamar funções que ainda não foram aplicadas no banco: o padrão é a
 * demonstração, mesmo com o Supabase do karaokê configurado.
 */
export const COMANDAS_LIVE = isSupabaseConfigured && import.meta.env.VITE_COMANDAS_LIVE === 'true';

let env: ComandaEnv | undefined;

/** Uma única fonte por página (a demonstração guarda estado e ouve outras abas). */
export function getComandaEnv(): ComandaEnv {
  if (env) return env;
  if (COMANDAS_LIVE) {
    const supabase = getSupabase();
    // O cliente tipado do karaokê não conhece as funções das comandas.
    const rpc: Rpc = async (fn, args) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      return { data, error: error ? { message: error.message } : null };
    };
    env = { backend: createSupabaseBackend(rpc), auth: createLiveAuth() };
  } else {
    const backend = createDemoBackend();
    env = { backend, auth: createDemoAuth(backend.demo) };
  }
  return env;
}
