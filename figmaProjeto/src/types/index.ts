export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  youtubeId: string;
  available: boolean;
}

export type QueueStatus = 'pending' | 'waiting' | 'next' | 'playing' | 'completed' | 'cancelled';

export interface QueueEntry {
  id: string;
  participant: string;
  phone?: string; // WhatsApp number for push notifications
  song: Song;
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
  duration: number | null; // seconds; null = manual
  priority: 1 | 2 | 3 | 4;
}

// Future Supabase entity
export interface Advertisement {
  id: string;
  title: string;
  imageUrl: string;
  duration: number | null;
  createdAt: string;
}

export interface TelaoState {
  currentContent: ScreenContent | null; // null = karaoke mode
  timeRemaining: number | null;
  isOnline: boolean;
  ads: Advertisement[];
}
