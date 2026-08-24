import { getSupabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/data/identity';
import { isValidVote, type ScoreCategory, type Vote } from '@/domain/voting/rules';
import type { Tables } from '@/lib/database.types';

export type VoteRow = Tables<'votes'>;
export type PerformanceResult = Tables<'performance_results'>;

export interface VoteInput {
  scores: Record<ScoreCategory, number>;
  wouldSingAlong: boolean;
}

/**
 * Registra o voto. Validação de payload é client-side (guia a UI, docs/domain), mas
 * a fonte de verdade — sem auto-voto, sem duplicado, janela de 60s, presença — é o
 * trigger `validate_vote` no servidor (docs/SECURITY.md).
 */
export async function submitVote(performanceId: string, input: VoteInput): Promise<void> {
  const userId = await ensureAnonymousSession();

  const vote: Vote = { voterId: userId, scores: input.scores, wouldSingAlong: input.wouldSingAlong };
  if (!isValidVote(vote)) {
    throw new Error('Notas inválidas — cada categoria precisa ser de 1 a 5.');
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('votes').insert({
    performance_id: performanceId,
    voter_id: userId,
    voice_score: input.scores.voice,
    performance_score: input.scores.performance,
    charisma_score: input.scores.charisma,
    fun_score: input.scores.fun,
    would_sing_along: input.wouldSingAlong,
  });
  if (error) {
    if (error.code === '23505') {
      throw new Error('Você já votou nesta apresentação.');
    }
    throw error;
  }
}

export async function getMyVote(performanceId: string): Promise<VoteRow | null> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('performance_id', performanceId)
    .eq('voter_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getResults(performanceId: string): Promise<PerformanceResult | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('performance_results')
    .select('*')
    .eq('performance_id', performanceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
