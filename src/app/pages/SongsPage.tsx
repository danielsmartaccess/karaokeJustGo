import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import {
  searchSongs,
  listMyFavoriteSongIds,
  listMyFavoriteSongs,
  addFavorite,
  removeFavorite,
  type Song,
} from '@/data/songs';
import { joinQueue } from '@/data/performances';
import { readActiveSession, type ActiveSession } from '@/lib/active-session';

type Tab = 'all' | 'favorites';

/**
 * Busca, favoritos (FASE 4) e entrada na fila (FASE 5) de música.
 */
export function SongsPage() {
  const navigate = useNavigate();
  const [activeSession] = useState<ActiveSession | null>(readActiveSession);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [queuingSongId, setQueuingSongId] = useState<string | null>(null);

  useEffect(() => {
    void loadFavoriteIds();
  }, []);

  const loadSongs = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    setSongs([]);
    try {
      const result = tab === 'favorites' ? await listMyFavoriteSongs() : await searchSongs(query);
      setSongs(result);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao buscar músicas.');
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  useEffect(() => {
    const timer = setTimeout(() => void loadSongs(), 250);
    return () => clearTimeout(timer);
  }, [loadSongs]);

  async function loadFavoriteIds() {
    try {
      setFavoriteIds(await listMyFavoriteSongIds());
    } catch {
      // silencioso — a lista de favoritos é reforço visual, não bloqueia a busca
    }
  }

  async function toggleFavorite(song: Song) {
    const isFavorite = favoriteIds.has(song.id);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFavorite) next.delete(song.id);
      else next.add(song.id);
      return next;
    });
    try {
      if (isFavorite) await removeFavorite(song.id);
      else await addFavorite(song.id);
      if (tab === 'favorites') await loadSongs();
    } catch (err) {
      // reverte a UI otimista se a chamada falhar
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFavorite) next.add(song.id);
        else next.delete(song.id);
        return next;
      });
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível favoritar.');
    }
  }

  async function handleJoinQueue(song: Song) {
    if (!activeSession) return;
    setQueuingSongId(song.id);
    setErrorMessage('');
    try {
      await joinQueue(activeSession.id, song.id);
      navigate('/queue');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Não foi possível entrar na fila.');
    } finally {
      setQueuingSongId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-6 py-12">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-400">Participante</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Buscar música
        </h1>
        {activeSession ? (
          <p className="text-sm text-muted">Sessão {activeSession.code}</p>
        ) : (
          <p className="text-sm text-muted">
            Você ainda não entrou em uma sessão —{' '}
            <Link to="/join" className="text-brand-400 hover:text-brand-300">
              entrar agora
            </Link>
            .
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('all')}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'all' ? 'bg-brand-500 text-stage-950' : 'bg-stage-800 text-muted hover:text-ink'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setTab('favorites')}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'favorites'
              ? 'bg-brand-500 text-stage-950'
              : 'bg-stage-800 text-muted hover:text-ink'
          }`}
        >
          Favoritas
        </button>
      </div>

      {tab === 'all' && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por música ou artista…"
          autoFocus
        />
      )}

      {errorMessage && <p className="text-center text-sm text-glow-400">{errorMessage}</p>}

      {loading && <p className="text-center text-sm text-muted">Carregando…</p>}

      {!loading && songs.length === 0 && (
        <p className="text-center text-sm text-muted">
          {tab === 'favorites' ? 'Nenhuma música favoritada ainda.' : 'Nenhuma música encontrada.'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {songs.map((song) => (
          <li
            key={song.id}
            className="flex items-center justify-between gap-3 rounded-card border border-stage-700 bg-stage-800 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{song.title}</p>
              <p className="truncate text-sm text-muted">
                {song.artist}
                {song.genre ? ` · ${song.genre}` : ''}
              </p>
            </div>
            {activeSession && (
              <Button
                size="md"
                disabled={queuingSongId === song.id}
                onClick={() => handleJoinQueue(song)}
                className="shrink-0"
              >
                {queuingSongId === song.id ? '…' : 'Cantar'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite(song)}
              aria-label={favoriteIds.has(song.id) ? 'Remover dos favoritos' : 'Favoritar'}
              className="shrink-0 text-xl"
            >
              {favoriteIds.has(song.id) ? '💙' : '🤍'}
            </Button>
          </li>
        ))}
      </ul>

      {activeSession && (
        <Link to="/queue" className="text-center text-sm text-brand-400 hover:text-brand-300">
          Ver fila →
        </Link>
      )}

      <Link to="/" className="text-center text-sm text-muted hover:text-ink">
        ← Voltar
      </Link>
    </main>
  );
}
