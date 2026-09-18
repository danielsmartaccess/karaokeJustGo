import type { Advertisement, KaraokeSnapshot, ScreenContent, Song } from '../types';

/**
 * Vocabulário de ações do karaokê.
 *
 * Fica num módulo próprio porque é compartilhado por dois consumidores:
 * o reducer local (src/store/KaraokeContext.tsx) e o repositório remoto
 * (src/services/karaokeRepository.ts). Toda regra de negócio passa por aqui —
 * componentes visuais nunca manipulam o estado diretamente.
 */
export type KaraokeAction =
  // Substitui o estado inteiro com o que veio do banco.
  | { type: 'HYDRATE'; snapshot: KaraokeSnapshot }
  // --- Fila ---
  | { type: 'ADD_TO_QUEUE'; participant: string; phone?: string; song: Song }
  | { type: 'PROPOSE_SONG'; participant: string; phone?: string; song: Song }
  | { type: 'APPROVE_ENTRY'; entryId: string }
  | { type: 'REJECT_ENTRY'; entryId: string }
  | { type: 'START_PLAYING'; entryId: string }
  | { type: 'FINISH_PLAYING' }
  | { type: 'SKIP_SONG' }
  | { type: 'CANCEL_ENTRY'; entryId: string }
  | { type: 'MOVE_UP'; entryId: string }
  | { type: 'MOVE_DOWN'; entryId: string }
  | { type: 'MARK_NOTIFIED'; entryId: string }
  // --- Telão ---
  | { type: 'SET_TELAO_CONTENT'; content: ScreenContent }
  | { type: 'CLEAR_TELAO_CONTENT' }
  | { type: 'TICK_TELAO' }
  | { type: 'SET_TELAO_ONLINE'; online: boolean }
  | { type: 'ADD_AD'; ad: Advertisement }
  | { type: 'REMOVE_AD'; id: string };

/** Ações que só existem no cliente e nunca viram escrita no banco. */
export const LOCAL_ONLY_ACTIONS: ReadonlySet<KaraokeAction['type']> = new Set([
  'HYDRATE',
  'TICK_TELAO',
]);
