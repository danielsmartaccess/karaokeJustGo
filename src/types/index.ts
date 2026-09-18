/**
 * Modelo de domínio do Karaokê Just Go.
 *
 * Os tipos abaixo são a fronteira entre a interface e a camada de serviços
 * (src/services). A UI nunca fala com o Supabase diretamente: ela consome
 * estes tipos, e o repositório traduz linhas do Postgres para eles.
 */

export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  /** Identificador da mídia na fonte atual (YouTube no MVP). */
  youtubeId: string;
  available: boolean;
}

/**
 * `next` é derivado: o primeiro item da fila. O banco persiste apenas
 * `waiting`; a posição na fila define quem é o próximo.
 */
export type QueueStatus = 'pending' | 'waiting' | 'next' | 'playing' | 'completed' | 'cancelled';

export interface QueueEntry {
  id: string;
  participant: string;
  /** WhatsApp, opcional — usado para avisar o participante que é a vez dele. */
  phone?: string;
  song: Song;
  /** Horário formatado (HH:MM) para exibição. */
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  status: QueueStatus;
}

export type AppView = 'participant' | 'tv' | 'host';

// --- Telão ---

export type ScreenContentType = 'karaoke' | 'cta' | 'notice' | 'ad' | 'qrcode';

export interface ScreenContent {
  id: string;
  type: ScreenContentType;
  title: string;
  content?: string;
  imageUrl?: string;
  /** Segundos; null = exibe até o Host remover manualmente. */
  duration: number | null;
  priority: 1 | 2 | 3 | 4;
}

export interface Advertisement {
  id: string;
  title: string;
  imageUrl: string;
  duration: number | null;
  createdAt: string;
}

export interface TelaoState {
  /** null = telão exibindo o karaokê (conteúdo de prioridade 1). */
  currentContent: ScreenContent | null;
  timeRemaining: number | null;
  /** Epoch em ms em que o conteúdo temporário expira; null = manual. */
  expiresAt: number | null;
  isOnline: boolean;
  ads: Advertisement[];
}

/** Estado completo de uma sala de karaokê — o que o repositório sincroniza. */
export interface KaraokeSnapshot {
  queue: QueueEntry[];
  pendingQueue: QueueEntry[];
  history: QueueEntry[];
  currentPlaying: QueueEntry | null;
  telao: TelaoState;
}
