import { getSupabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/data/identity';
import { canTransition, CANCELLED, type PerformanceState } from '@/domain/performance/state-machine';
import type { Tables } from '@/lib/database.types';

export type Performance = Tables<'performances'>;

export interface QueueEntry {
  id: string;
  status: Performance['status'];
  createdAt: string;
  votingStartedAt: string | null;
  /** O que a pessoa digitou que quer cantar (texto livre — FASE 10, sem catálogo). */
  songQuery: string;
  /** Vídeo de karaokê resolvido pelo host ao chamar; `null` até ele colar o link. */
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  performerId: string;
  performerName: string;
  isMine: boolean;
}

/**
 * Junta `performances` com o nome de quem canta (`public_profiles` — projeção pública
 * sem WhatsApp, docs/SECURITY.md). O que vai ser cantado é texto livre na própria
 * linha (`song_query`) desde a FASE 10 — não há mais join com catálogo.
 */
async function hydrate(performances: Performance[]): Promise<QueueEntry[]> {
  if (performances.length === 0) return [];
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const myId = sessionData.session?.user.id ?? null;

  const performerIds = Array.from(new Set(performances.map((p) => p.performer_id)));

  const { data: profiles, error: profilesError } = await supabase
    .from('public_profiles')
    .select('id,display_name')
    .in('id', performerIds);
  if (profilesError) throw profilesError;

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? 'Participante']));

  return performances.map((p) => ({
    id: p.id,
    status: p.status,
    createdAt: p.created_at,
    votingStartedAt: p.voting_started_at,
    songQuery: p.song_query,
    youtubeVideoId: p.youtube_video_id,
    youtubeUrl: p.youtube_url,
    performerId: p.performer_id,
    performerName: nameById.get(p.performer_id) ?? 'Participante',
    isMine: p.performer_id === myId,
  }));
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

/**
 * Quem está em votação ou com resultado pronto agora (FASE 7). Separado de
 * `getCurrentPerformance` de propósito: o host pode chamar o próximo cantor
 * enquanto a votação do anterior ainda está rolando — os dois coexistem.
 */
export async function getVotingPerformance(sessionId: string): Promise<QueueEntry | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .select('*')
    .eq('session_id', sessionId)
    .in('status', ['VOTING', 'RESULT'])
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [entry] = await hydrate([data]);
  return entry;
}

export async function joinQueue(sessionId: string, songQuery: string): Promise<Performance> {
  const query = songQuery.trim();
  if (!query) throw new Error('Digite o nome da música que você quer cantar.');

  const userId = await ensureAnonymousSession();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .insert({ session_id: sessionId, song_query: query, performer_id: userId })
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

export interface PerformanceVideo {
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
}

/**
 * Host: marca "começou a cantar". Se passar o vídeo do YouTube (link que ele colou e
 * conferiu), grava junto na mesma transição CALLED → PERFORMING — o telão já sobe o
 * player. Sem vídeo, o telão cai no fallback de texto.
 */
export async function markPerforming(
  performanceId: string,
  video?: PerformanceVideo,
): Promise<Performance> {
  const supabase = getSupabase();
  const patch: { status: 'PERFORMING'; youtube_video_id?: string | null; youtube_url?: string | null } =
    { status: 'PERFORMING' };
  if (video) {
    patch.youtube_video_id = video.youtubeVideoId;
    patch.youtube_url = video.youtubeUrl;
  }
  const { data, error } = await supabase
    .from('performances')
    .update(patch)
    .eq('id', performanceId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Host: define/troca o vídeo de karaokê de uma apresentação sem mexer no status
 * (ainda CALLED, ou já PERFORMING e o vídeo estava errado). `validate_performance_transition`
 * deixa passar porque `new.status = old.status`.
 */
export async function setPerformanceVideo(
  performanceId: string,
  video: PerformanceVideo,
): Promise<Performance> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .update({ youtube_video_id: video.youtubeVideoId, youtube_url: video.youtubeUrl })
    .eq('id', performanceId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function startVoting(performanceId: string): Promise<Performance> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .update({ status: 'VOTING' })
    .eq('id', performanceId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function finishVoting(performanceId: string): Promise<Performance> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .update({ status: 'RESULT' })
    .eq('id', performanceId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function completePerformance(performanceId: string): Promise<Performance> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performances')
    .update({ status: 'COMPLETED' })
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
