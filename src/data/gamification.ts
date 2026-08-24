import { getSupabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type Badge = Tables<'badges'>;
export type UserReputation = Tables<'user_reputation'>;
export type SessionReputation = Tables<'session_reputation'>;

export interface EarnedBadge {
  badge: Badge;
  earnedAt: string;
}

/**
 * XP nunca é escrito pelo cliente (docs/SECURITY.md) — só lido. Quem grava são as
 * triggers SECURITY DEFINER na migration da FASE 8, reagindo a ações que já
 * aconteceram (entrar na sessão, cantar, votar, favoritar).
 */
export async function getMyReputation(): Promise<UserReputation | null> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_reputation')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyBadges(): Promise<EarnedBadge[]> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('user_badges')
    .select('earned_at, badges(*)')
    .eq('profile_id', userId)
    .order('earned_at', { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .filter((row): row is typeof row & { badges: Badge } => row.badges !== null)
    .map((row) => ({ badge: row.badges, earnedAt: row.earned_at }));
}

export async function getSessionLeaderboard(
  sessionId: string,
  limit = 10,
): Promise<SessionReputation[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('session_reputation')
    .select('*')
    .eq('session_id', sessionId)
    .order('session_xp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Assina novos eventos de XP da sessão, para atualizar rankings ao vivo. */
export function subscribeToPointsTransactions(sessionId: string, onChange: () => void): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`points:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'points_transactions',
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
