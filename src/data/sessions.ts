import { getSupabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/data/identity';
import { canTransition, type SessionState } from '@/domain/session/state-machine';
import type { Tables } from '@/lib/database.types';

export type Session = Tables<'sessions'>;
export type CtaMessage = 'qr' | 'pedido' | 'vote' | 'next' | 'celebrate';
export type PlaybackCommand = 'PLAY' | 'PAUSE';

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

/**
 * Host: "modo DJ" — define o vídeo do YouTube que o telão toca enquanto NÃO há
 * ninguém cantando (o telão sempre prioriza a apresentação atual sobre o DJ).
 * `null` para parar. Só staff do venue pode escrever (RLS de `sessions`).
 */
export async function setDjVideo(sessionId: string, youtubeVideoId: string | null): Promise<Session> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .update({
      dj_youtube_video_id: youtubeVideoId,
      dj_started_at: youtubeVideoId ? new Date().toISOString() : null,
    })
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Assina mudanças na própria linha da sessão (status, modo DJ) — usado pelo telão. */
export function subscribeToSession(sessionId: string, onChange: () => void): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`session:${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Host: dispara uma chamada de ação no telão (ex.: "Escaneie o QR", "Vote agora!").
 * É um sinal efêmero — o telão calcula sozinho (a partir de `cta_triggered_at`) quando
 * parar de mostrar o banner, então não existe `clearCta`.
 */
export async function broadcastCta(sessionId: string, message: CtaMessage): Promise<Session> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .update({ cta_message: message, cta_triggered_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Host: pede pro telão mostrar o ranking em tela cheia até ele mandar fechar. */
export async function showRankingOnTelao(sessionId: string): Promise<Session> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .update({ display_override: 'RANKING' })
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Host: tira o ranking do telão — manual, ou automático ao chamar/marcar/votar de novo. */
export async function clearDisplayOverride(sessionId: string): Promise<Session> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .update({ display_override: null })
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Host: comando remoto de play/pause para o player do telão (outro aparelho/navegador).
 * O telão assina `subscribeToSession` e aplica o comando comparando `playback_command_at`
 * com o último timestamp já aplicado, para não repetir a ação.
 */
export async function sendPlaybackCommand(sessionId: string, command: PlaybackCommand): Promise<Session> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sessions')
    .update({ playback_command: command, playback_command_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Contagem ao vivo de participantes da sessão — usada no cabeçalho do Host e no lobby do telão. */
export async function getParticipantCount(sessionId: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('session_participants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  if (error) throw error;
  return count ?? 0;
}

/** Assina novas entradas na sessão — usada para manter a contagem de participantes ao vivo. */
export function subscribeToSessionParticipants(sessionId: string, onChange: () => void): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`participants:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'session_participants',
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
