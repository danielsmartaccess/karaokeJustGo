import { getSupabase } from '@/lib/supabase';
import { canTransition, type SessionState } from '@/domain/session/state-machine';
import type { Tables } from '@/lib/database.types';

export type Session = Tables<'sessions'>;

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
