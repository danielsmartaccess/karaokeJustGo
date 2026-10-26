/**
 * Acompanhamento da solicitação do próprio participante.
 *
 * O participante não tem login: a "senha" dele é o par nome + música. O id da
 * entrada não serve de chave porque muda — o reducer cria um id local ('p…') e
 * o banco devolve um uuid no primeiro realtime. Por isso casamos por conteúdo.
 */
import type { KaraokeSnapshot, QueueEntry } from '../types';

export interface ParticipantTicket {
  participant: string;
  youtubeId: string;
  /** Título e canal, só para exibir enquanto a entrada ainda não foi localizada. */
  title: string;
  artist: string;
}

export type TicketProgress =
  | { stage: 'pending'; entry: QueueEntry }
  /** `ahead` = quantas músicas vão cantar antes (0 = é a próxima). */
  | { stage: 'queued'; entry: QueueEntry; ahead: number }
  | { stage: 'playing'; entry: QueueEntry }
  | { stage: 'done'; entry: QueueEntry }
  | { stage: 'unknown' };

const matches = (ticket: ParticipantTicket) => (entry: QueueEntry) =>
  entry.participant === ticket.participant && entry.song.youtubeId === ticket.youtubeId;

/** Pega a ocorrência mais recente, para quem repete a mesma música. */
function last<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}

export function trackTicket(state: KaraokeSnapshot, ticket: ParticipantTicket): TicketProgress {
  const isMine = matches(ticket);

  if (state.currentPlaying && isMine(state.currentPlaying)) {
    return { stage: 'playing', entry: state.currentPlaying };
  }

  const queued = last(state.queue.filter(isMine));
  if (queued) {
    return { stage: 'queued', entry: queued, ahead: state.queue.indexOf(queued) };
  }

  const pending = last(state.pendingQueue.filter(isMine));
  if (pending) return { stage: 'pending', entry: pending };

  // O histórico vem do mais recente para o mais antigo.
  const finished = state.history.find(isMine);
  if (finished) return { stage: 'done', entry: finished };

  return { stage: 'unknown' };
}

const STORAGE_KEY = 'jg-karaoke:participant-ticket';

export function loadTicket(): ParticipantTicket | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ParticipantTicket>;
    if (!parsed.participant || !parsed.youtubeId) return null;
    return {
      participant: parsed.participant,
      youtubeId: parsed.youtubeId,
      title: parsed.title ?? '',
      artist: parsed.artist ?? '',
    };
  } catch {
    return null;
  }
}

export function saveTicket(ticket: ParticipantTicket | null): void {
  try {
    if (ticket) localStorage.setItem(STORAGE_KEY, JSON.stringify(ticket));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Navegação privada ou storage bloqueado: o acompanhamento só não sobrevive ao reload.
  }
}
