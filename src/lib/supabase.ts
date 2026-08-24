import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Cliente Supabase compartilhado.
 * Apenas a chave pública (anon) é usada no frontend — NUNCA a service_role.
 * As variáveis são injetadas pelo Vite a partir do .env (prefixo VITE_).
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Indica se o backend está configurado (útil para telas em modo demo). */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient<Database> | null = null;

/**
 * Retorna o cliente Supabase. Lança erro claro se as variáveis não estiverem
 * configuradas — evita falhas silenciosas em runtime.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env',
    );
  }
  if (!client) {
    client = createClient<Database>(url, anonKey);
  }
  return client;
}
