import { getSupabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/data/identity';
import { canTransition, type SessionState } from '@/domain/session/state-machine';
import type { Tables } from '@/lib/database.types';

export type Session = Tables<'sessions'>;

/**
 * Marca este profile como "presente" na sessão (docs/SECURITY.md: elegibilidade de
 * voto exige "votante presente/online"). Proxy simples — já entrou na sessão —, não
 * presença efêmera via WebSocket (ver nota na migration da FASE 7).
 */
export async function recordSessionParticipation(sessionId: string): Promise<void> {
  const userId = await ensureAnonymousSession();
  const supabase = getSupabase();
  const { error } = await supabase
    .from('session_participants')
    .upsert({ session_id: sessionId, profile_id: userId }, { onConflict: 'session_id,profile_id' });
  if (error) throw error;
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listVenueSessions(venueId: string): Promise<Session[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSession(venueId: string, title?: string): Promise<Session> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .insert({ venue_id: venueId, title: title || null })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function setSessionStatus(session: Session, to: SessionState): Promise<Session> {
  if (!canTransition(session.status, to)) {
    throw new Error(`Não é possível mudar a sessão de ${session.status} para ${to}.`);
  }
  const patch: Partial<Session> = { status: to };
  const now = new Date().toISOString();
  if (to === 'OPEN') patch.opened_at = now;
  if (to === 'LIVE') patch.live_at = now;
  if (to === 'CLOSED') patch.closed_at = now;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .update(patch)
    .eq('id', session.id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export const openSession = (session: Session) => setSessionStatus(session, 'OPEN');
export const goLive = (session: Session) => setSessionStatus(session, 'LIVE');
export const closeSession = (session: Session) => setSessionStatus(session, 'CLOSED');
