import { getSupabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type Profile = Tables<'profiles'>;
export type Venue = Tables<'venues'>;

/**
 * Identidade do app usa Supabase Anonymous Auth (seção 32): sem senha, sem
 * fricção — cadastro é só nome + WhatsApp. Serve tanto para participante quanto
 * para o host (o papel HOST/ADMIN vem de `venue_staff`, não do método de login).
 * Requer "Anonymous Sign-ins" habilitado no projeto (Authentication → Providers).
 */
export async function ensureAnonymousSession(): Promise<string> {
  const supabase = getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session) return sessionData.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('Falha ao criar sessão anônima.');
  return data.user.id;
}

export interface ProfileInput {
  displayName: string;
  whatsapp?: string;
}

/** Atualiza o profile do usuário atual (criado automaticamente no signup pelo trigger). */
export async function upsertMyProfile(input: ProfileInput): Promise<Profile> {
  const supabase = getSupabase();
  const userId = await ensureAnonymousSession();
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: input.displayName, whatsapp: input.whatsapp || null })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Papel do usuário atual no venue (null = participante comum, sem cargo de staff). */
export async function getMyVenueStaffRole(venueId: string): Promise<'HOST' | 'ADMIN' | null> {
  const supabase = getSupabase();
  const userId = await ensureAnonymousSession();
  const { data, error } = await supabase
    .from('venue_staff')
    .select('role')
    .eq('venue_id', venueId)
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

export async function getVenueById(id: string): Promise<Venue | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('venues').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Resolve o venue desta implantação a partir do slug (nunca hardcode o id —
 * docs/PRODUCT.md). O slug vem de VITE_DEFAULT_VENUE_SLUG.
 */
export async function getDefaultVenue(): Promise<Venue> {
  const slug = import.meta.env.VITE_DEFAULT_VENUE_SLUG;
  if (!slug) {
    throw new Error('VITE_DEFAULT_VENUE_SLUG não configurado no .env');
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from('venues').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Venue "${slug}" não encontrado.`);
  return data;
}
