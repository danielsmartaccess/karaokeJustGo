import { getSupabase, ROOM_SLUG } from '../lib/supabase';
import type {
  KaraokeAdvertisementRow,
  KaraokeQueueEntryRow,
  KaraokeRoomRow,
  KaraokeScreenContentRow,
} from '../lib/database.types';
import type {
  Advertisement,
  KaraokeSnapshot,
  QueueEntry,
  ScreenContent,
  TelaoState,
} from '../types';
import type { KaraokeAction } from '../store/actions';

/**
 * Repositório da sala de karaokê.
 *
 * Traduz o modelo de domínio (src/types) para as tabelas `karaoke_*` do
 * Supabase e devolve um snapshot pronto para o reducer. Existe para que o
 * telão, o celular do participante e o notebook do Host compartilhem o mesmo
 * estado — sem ele a aplicação seria um protótipo de aba única.
 */

function hhmm(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function rowToEntry(row: KaraokeQueueEntryRow): QueueEntry {
  return {
    id: row.id,
    participant: row.participant,
    phone: row.phone ?? undefined,
    song: {
      id: row.youtube_id,
      title: row.song_title,
      artist: row.song_artist,
      duration: row.song_duration,
      thumbnail: row.song_thumbnail ?? `https://img.youtube.com/vi/${row.youtube_id}/mqdefault.jpg`,
      youtubeId: row.youtube_id,
      available: true,
    },
    requestedAt: hhmm(row.requested_at),
    startedAt: row.started_at ? hhmm(row.started_at) : undefined,
    finishedAt: row.finished_at ? hhmm(row.finished_at) : undefined,
    notifiedAt: row.notified_at ? hhmm(row.notified_at) : undefined,
    status: row.status,
  };
}

function rowToContent(row: KaraokeScreenContentRow): ScreenContent {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.body ?? undefined,
    imageUrl: row.image_url ?? undefined,
    duration: row.duration_seconds,
    priority: (row.priority as ScreenContent['priority']) ?? 3,
  };
}

function rowToAd(row: KaraokeAdvertisementRow): Advertisement {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    duration: row.duration_seconds,
    createdAt: hhmm(row.created_at),
  };
}

/** Garante que a sala desta implantação existe e devolve o id. */
export async function ensureRoom(): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('karaoke_rooms')
    .select('id')
    .eq('slug', ROOM_SLUG)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.id;

  const { data: created, error: insertError } = await supabase
    .from('karaoke_rooms')
    .insert({ slug: ROOM_SLUG, name: 'Karaokê Just Go' })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return created.id;
}

async function buildTelaoState(
  roomId: string,
  room: KaraokeRoomRow,
  adRows: KaraokeAdvertisementRow[],
): Promise<TelaoState> {
  const supabase = getSupabase();
  const ads = adRows.map(rowToAd);

  const expiresAt = room.screen_expires_at ? Date.parse(room.screen_expires_at) : null;
  const expired = expiresAt !== null && expiresAt <= Date.now();

  const karaokeMode: TelaoState = {
    currentContent: null,
    timeRemaining: null,
    expiresAt: null,
    isOnline: room.screen_online,
    ads,
  };

  if (!room.screen_content_id || expired) return karaokeMode;

  const { data } = await supabase
    .from('karaoke_screen_contents')
    .select('*')
    .eq('id', room.screen_content_id)
    .eq('room_id', roomId)
    .maybeSingle();

  if (!data) return karaokeMode;

  return {
    currentContent: rowToContent(data as KaraokeScreenContentRow),
    timeRemaining: expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : null,
    expiresAt,
    isOnline: room.screen_online,
    ads,
  };
}

/** Lê o estado completo da sala. */
export async function fetchSnapshot(roomId: string): Promise<KaraokeSnapshot> {
  const supabase = getSupabase();

  const [roomRes, entriesRes, adsRes] = await Promise.all([
    supabase.from('karaoke_rooms').select('*').eq('id', roomId).single(),
    supabase
      .from('karaoke_queue_entries')
      .select('*')
      .eq('room_id', roomId)
      .order('position', { ascending: true })
      .order('requested_at', { ascending: true }),
    supabase
      .from('karaoke_advertisements')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false }),
  ]);

  if (roomRes.error) throw roomRes.error;
  if (entriesRes.error) throw entriesRes.error;
  if (adsRes.error) throw adsRes.error;

  const room = roomRes.data as KaraokeRoomRow;
  const rows = (entriesRes.data ?? []) as KaraokeQueueEntryRow[];

  // `next` é derivado da posição na fila, não persistido no banco.
  const queue: QueueEntry[] = rows
    .filter((r) => r.status === 'waiting')
    .map(rowToEntry)
    .map((e, i) => ({ ...e, status: i === 0 ? 'next' : 'waiting' }));

  const pendingQueue = rows.filter((r) => r.status === 'pending').map(rowToEntry);

  const history = rows
    .filter((r) => r.status === 'completed' || r.status === 'cancelled')
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
    .map(rowToEntry);

  const playingRow = rows.find((r) => r.status === 'playing');

  return {
    queue,
    pendingQueue,
    history,
    currentPlaying: playingRow ? rowToEntry(playingRow) : null,
    telao: await buildTelaoState(roomId, room, (adsRes.data ?? []) as KaraokeAdvertisementRow[]),
  };
}

async function nextPosition(roomId: string): Promise<number> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('karaoke_queue_entries')
    .select('position')
    .eq('room_id', roomId)
    .eq('status', 'waiting')
    .order('position', { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? 0) + 1;
}

/**
 * Persiste uma ação já aplicada otimisticamente na interface.
 * `state` é o snapshot ANTES da ação, usado pelas ações que dependem do
 * contexto: trocar posições na fila e encerrar a apresentação corrente.
 */
export async function applyAction(
  roomId: string,
  action: KaraokeAction,
  state: KaraokeSnapshot,
): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  switch (action.type) {
    case 'ADD_TO_QUEUE':
    case 'PROPOSE_SONG': {
      const queued = action.type === 'ADD_TO_QUEUE';
      await supabase.from('karaoke_queue_entries').insert({
        room_id: roomId,
        participant: action.participant,
        phone: action.phone ?? null,
        song_title: action.song.title,
        song_artist: action.song.artist,
        song_duration: action.song.duration,
        song_thumbnail: action.song.thumbnail,
        youtube_id: action.song.youtubeId,
        status: queued ? 'waiting' : 'pending',
        position: queued ? await nextPosition(roomId) : 0,
        requested_at: now,
      });
      return;
    }

    case 'APPROVE_ENTRY': {
      await supabase
        .from('karaoke_queue_entries')
        .update({ status: 'waiting', position: await nextPosition(roomId) })
        .eq('id', action.entryId);
      return;
    }

    case 'REJECT_ENTRY': {
      await supabase.from('karaoke_queue_entries').delete().eq('id', action.entryId);
      return;
    }

    case 'START_PLAYING': {
      // Regra de negócio 3: apenas uma apresentação em execução.
      if (state.currentPlaying) {
        await supabase
          .from('karaoke_queue_entries')
          .update({ status: 'completed', finished_at: now })
          .eq('id', state.currentPlaying.id);
      }
      await supabase
        .from('karaoke_queue_entries')
        .update({ status: 'playing', started_at: now })
        .eq('id', action.entryId);
      return;
    }

    case 'FINISH_PLAYING':
    case 'SKIP_SONG': {
      if (!state.currentPlaying) return;
      await supabase
        .from('karaoke_queue_entries')
        .update({
          status: action.type === 'FINISH_PLAYING' ? 'completed' : 'cancelled',
          finished_at: now,
        })
        .eq('id', state.currentPlaying.id);
      return;
    }

    case 'MARK_NOTIFIED': {
      await supabase
        .from('karaoke_queue_entries')
        .update({ notified_at: now })
        .eq('id', action.entryId);
      return;
    }

    case 'CANCEL_ENTRY': {
      await supabase
        .from('karaoke_queue_entries')
        .update({ status: 'cancelled', finished_at: now })
        .eq('id', action.entryId);
      return;
    }

    case 'MOVE_UP':
    case 'MOVE_DOWN': {
      const idx = state.queue.findIndex((e) => e.id === action.entryId);
      const target = action.type === 'MOVE_UP' ? idx - 1 : idx + 1;
      if (idx < 0 || target < 0 || target >= state.queue.length) return;

      const ids = [state.queue[idx].id, state.queue[target].id];
      const { data } = await supabase
        .from('karaoke_queue_entries')
        .select('id, position')
        .in('id', ids);
      const a = data?.find((r) => r.id === ids[0]);
      const b = data?.find((r) => r.id === ids[1]);
      if (!a || !b) return;

      await supabase.from('karaoke_queue_entries').update({ position: b.position }).eq('id', a.id);
      await supabase.from('karaoke_queue_entries').update({ position: a.position }).eq('id', b.id);
      return;
    }

    case 'SET_TELAO_CONTENT': {
      const { content } = action;
      const { data, error } = await supabase
        .from('karaoke_screen_contents')
        .insert({
          room_id: roomId,
          type: content.type,
          title: content.title,
          body: content.content ?? null,
          image_url: content.imageUrl ?? null,
          duration_seconds: content.duration,
          priority: content.priority,
        })
        .select('id')
        .single();
      if (error) throw error;

      await supabase
        .from('karaoke_rooms')
        .update({
          screen_content_id: data.id,
          screen_expires_at: content.duration
            ? new Date(Date.now() + content.duration * 1000).toISOString()
            : null,
          updated_at: now,
        })
        .eq('id', roomId);
      return;
    }

    case 'CLEAR_TELAO_CONTENT': {
      await supabase
        .from('karaoke_rooms')
        .update({ screen_content_id: null, screen_expires_at: null, updated_at: now })
        .eq('id', roomId);
      return;
    }

    case 'SET_TELAO_ONLINE': {
      await supabase
        .from('karaoke_rooms')
        .update({ screen_online: action.online, updated_at: now })
        .eq('id', roomId);
      return;
    }

    case 'ADD_AD': {
      await supabase.from('karaoke_advertisements').insert({
        room_id: roomId,
        title: action.ad.title,
        image_url: action.ad.imageUrl,
        duration_seconds: action.ad.duration,
      });
      return;
    }

    case 'REMOVE_AD': {
      await supabase.from('karaoke_advertisements').delete().eq('id', action.id);
      return;
    }

    default:
      return;
  }
}

/** Assina as mudanças da sala. Devolve a função de cancelamento. */
export function subscribeToRoom(roomId: string, onChange: () => void): () => void {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`karaoke-room-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'karaoke_queue_entries',
        filter: `room_id=eq.${roomId}`,
      },
      onChange,
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'karaoke_advertisements',
        filter: `room_id=eq.${roomId}`,
      },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'karaoke_rooms', filter: `id=eq.${roomId}` },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
