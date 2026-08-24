import { getSupabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/data/identity';
import type { Tables } from '@/lib/database.types';

export type Song = Tables<'songs'>;

/** Remove caracteres com significado especial no filtro PostgREST antes de interpolar. */
function sanitizeForIlike(value: string): string {
  return value.replace(/[%,()]/g, '');
}

export async function searchSongs(query: string): Promise<Song[]> {
  const supabase = getSupabase();
  const term = sanitizeForIlike(query.trim());

  let request = supabase.from('songs').select('*').order('title').limit(50);
  if (term) {
    request = request.or(`title.ilike.%${term}%,artist.ilike.%${term}%`);
  }

  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}

export async function listMyFavoriteSongIds(): Promise<Set<string>> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('user_favorite_songs')
    .select('song_id')
    .eq('profile_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.song_id));
}

export async function listMyFavoriteSongs(): Promise<Song[]> {
  const supabase = getSupabase();
  const favoriteIds = await listMyFavoriteSongIds();
  if (favoriteIds.size === 0) return [];

  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .in('id', Array.from(favoriteIds))
    .order('title');
  if (error) throw error;
  return data ?? [];
}

export async function addFavorite(songId: string): Promise<void> {
  const userId = await ensureAnonymousSession();
  const supabase = getSupabase();
  const { error } = await supabase
    .from('user_favorite_songs')
    .insert({ profile_id: userId, song_id: songId });
  if (error) throw error;
}

export async function removeFavorite(songId: string): Promise<void> {
  const userId = await ensureAnonymousSession();
  const supabase = getSupabase();
  const { error } = await supabase
    .from('user_favorite_songs')
    .delete()
    .eq('profile_id', userId)
    .eq('song_id', songId);
  if (error) throw error;
}
