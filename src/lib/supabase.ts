import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Cliente Supabase compartilhado.
 * Apenas a chave pública (anon) é usada no frontend — NUNCA a service_role.
 * As variáveis são injetadas pelo Vite a partir do .env (prefixo VITE_).
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Quando falso, a aplicação roda em MODO DEMO: o estado vive só na memória do
 * navegador e nada é compartilhado entre dispositivos. Útil para aula,
 * apresentação e desenvolvimento sem backend.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/** Slug da sala de karaokê desta implantação. */
export const ROOM_SLUG = import.meta.env.VITE_KARAOKE_ROOM_SLUG || 'just-go';

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env',
    );
  }
  if (!client) {
    client = createClient<Database>(url, anonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}
