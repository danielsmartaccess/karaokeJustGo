import { getSupabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type Award = Tables<'awards'>;

export interface AwardWithDetails extends Award {
  performerName: string;
  songTitle: string | null;
}

const PERFORMANCE_OF_THE_NIGHT = 'PERFORMANCE_OF_THE_NIGHT';

/**
 * O vencedor é calculado DENTRO da function no banco (maior Nota da Plateia entre as
 * apresentações COMPLETED) — o cliente só dispara o anúncio, nunca escolhe quem ganha
 * (mesmo princípio de XP: servidor decide o valor, docs/SECURITY.md).
 */
export async function announcePerformanceOfTheNight(sessionId: string): Promise<Award> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('announce_performance_of_the_night', {
    p_session_id: sessionId,
  });
  if (error) throw error;
  return data;
}

export async function getPerformanceOfTheNight(sessionId: string): Promise<AwardWithDetails | null> {
  const supabase = getSupabase();
  const { data: award, error } = await supabase
    .from('awards')
    .select('*')
    .eq('session_id', sessionId)
    .eq('code', PERFORMANCE_OF_THE_NIGHT)
    .maybeSingle();
  if (error) throw error;
  if (!award) return null;

  const { data: performance, error: perfError } = await supabase
    .from('performances')
    .select('performer_id, song_query')
    .eq('id', award.performance_id)
    .single();
  if (perfError) throw perfError;

  const { data: profile } = await supabase
    .from('public_profiles')
    .select('display_name')
    .eq('id', performance.performer_id)
    .maybeSingle();

  return {
    ...award,
    performerName: profile?.display_name ?? 'Participante',
    songTitle: performance.song_query || null,
  };
}

export function subscribeToAwards(sessionId: string, onChange: () => void): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`awards:${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'awards', filter: `session_id=eq.${sessionId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
