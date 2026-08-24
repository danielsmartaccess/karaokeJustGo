import { getSupabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/data/identity';
import { canTransition, CANCELLED, type PerformanceState } from '@/domain/performance/state-machine';
import type { Tables } from '@/lib/database.types';

export type Performance = Tables<'performances'>;

export interface QueueEntry {
  id: string;
  status: Performance['status'];
  createdAt: string;
  song: { id: string; title: string; artist: string } | null;
  performerId: string;
  performerName: string;
  isMine: boolean;
}

/**
 * Junta `performances` com título/artista (`songs`) e nome de quem canta
 * (`public_profiles` — projeção pública sem WhatsApp, docs/SECURITY.md).
 */
async function hydrate(performances: Performance[]): Promise<QueueEntry[]> {
  if (performances.length === 0) return [];
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const myId = sessionData.session?.user.id ?? null;

  const songIds = Array.from(new Set(performances.map((p) => p.song_id)));
  const performerIds = Array.from(new Set(performances.map((p) => p.performer_id)));

  const [{ data: songs, error: songsError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from('songs').select('id,title,artist').in('id', songIds),
      supabase.from('public_profiles').select('id,display_name').in('id', performerIds),
    ]);
  if (songsError) throw songsError;
  if (profilesError) throw profilesError;

  const songById = new Map((songs ?? []).map((s) => [s.id, s]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? 'Participante']));

  return performances.map((p) => {
    const song = songById.get(p.song_id);
    return {
      id: p.id,
      status: p.status,
      createdAt: p.created_at,
      song: song ? { id: song.id, title: song.title, artist: song.artist } : null,
      performerId: p.performer_id,
      performerName: nameById.get(p.performer_id) ?? 'Participante',
      isMine: p.performer_id === myId,
    };
  });
}

/** A fila é `performances` com status QUEUED, ordenadas por chegada (FIFO). */
export async function getQueue(sessionId: string): Promise<QueueEntry[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'QUEUED')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return hydrate(data ?? []);
}

/** Quem está CALLED ou PERFORMING agora (no máximo um por sessão — índice único). */
export async function getCurrentPerformance(sessionId: string): Promise<QueueEntry | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .select('*')
    .eq('session_id', sessionId)
    .in('status', ['CALLED', 'PERFORMING'])
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [entry] = await hydrate([data]);
  return entry;
}

export async function joinQueue(sessionId: string, songId: string): Promise<Performance> {
  const userId = await ensureAnonymousSession();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .insert({ session_id: sessionId, song_id: songId, performer_id: userId })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('Você já está na fila desta sessão.');
    }
    throw error;
  }
  return data;
}

export async function leaveQueue(performanceId: string, currentStatus: Performance['status']) {
  if (!canTransition(currentStatus as PerformanceState, CANCELLED)) {
    throw new Error(`Não é possível sair da fila no estado ${currentStatus}.`);
  }
  const supabase = getSupabase();
  const { error } = await supabase
    .from('performances')
    .update({ status: CANCELLED })
    .eq('id', performanceId);
  if (error) throw error;
}

/** Host: chama o primeiro da fila (FIFO). Falha se já houver alguém CALLED/PERFORMING. */
export async function callNext(sessionId: string): Promise<Performance> {
  const queue = await getQueue(sessionId);
  const next = queue[0];
  if (!next) throw new Error('A fila está vazia.');

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .update({ status: 'CALLED' })
    .eq('id', next.id)
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('Já tem alguém chamado/cantando nesta sessão.');
    }
    throw error;
  }
  return data;
}

export async function markPerforming(performanceId: string): Promise<Performance> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .update({ status: 'PERFORMING' })
    .eq('id', performanceId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Assina mudanças em tempo real na fila/apresentação atual da sessão (FASE 6). */
export function subscribeToPerformances(sessionId: string, onChange: () => void): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`performances:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'performances', filter: `session_id=eq.${sessionId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
