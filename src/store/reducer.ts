import type { KaraokeSnapshot, QueueEntry, QueueStatus, TelaoState } from '../types';
import { INITIAL_HISTORY, INITIAL_PLAYING, INITIAL_QUEUE, MOCK_ADS } from '../data/mockData';
import type { KaraokeAction } from './actions';

/**
 * Regras de negocio da sala de karaoke, em funcao pura.
 *
 * Isolado do React de proposito: e o unico lugar onde a fila e o telao mudam
 * de estado, entao e aqui que os testes de regra de negocio batem.
 */

export const emptyTelao: TelaoState = {
  currentContent: null,
  timeRemaining: null,
  expiresAt: null,
  isOnline: true,
  ads: [],
};

export const emptyState: KaraokeSnapshot = {
  queue: [],
  pendingQueue: [],
  history: [],
  currentPlaying: null,
  telao: emptyTelao,
};

/** Estado inicial do MODO DEMO (sem Supabase), com dados de demonstracao. */
export const demoState: KaraokeSnapshot = {
  queue: INITIAL_QUEUE,
  pendingQueue: [],
  history: INITIAL_HISTORY,
  currentPlaying: INITIAL_PLAYING,
  telao: { ...emptyTelao, ads: MOCK_ADS },
};

/** A primeira da fila é sempre a próxima — status derivado, nunca persistido. */
function updatePositions(queue: QueueEntry[]): QueueEntry[] {
  return queue.map((entry, index) => ({
    ...entry,
    status: (index === 0 ? 'next' : 'waiting') as QueueStatus,
  }));
}

/**
 * Identificador local de uma entrada da fila.
 *
 * Date.now() sozinho colide: duas entradas criadas no mesmo milissegundo
 * ganhavam o mesmo id e as acoes da fila (mover, cancelar, iniciar) atingiam a
 * entrada errada. No modo AO VIVO o id autoritativo vem do banco (uuid).
 */
let localIdCounter = 0;

function newId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}${Date.now()}-${localIdCounter}`;
}

function nowTime(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function reducer(state: KaraokeSnapshot, action: KaraokeAction): KaraokeSnapshot {
  switch (action.type) {
    case 'HYDRATE':
      return action.snapshot;

    // --- Fila ---
    case 'ADD_TO_QUEUE': {
      const entry: QueueEntry = {
        id: newId('q'),
        participant: action.participant,
        phone: action.phone,
        song: action.song,
        requestedAt: nowTime(),
        status: 'waiting',
      };
      return { ...state, queue: updatePositions([...state.queue, entry]) };
    }

    case 'PROPOSE_SONG': {
      const entry: QueueEntry = {
        id: newId('p'),
        participant: action.participant,
        phone: action.phone,
        song: action.song,
        requestedAt: nowTime(),
        status: 'pending',
      };
      return { ...state, pendingQueue: [...state.pendingQueue, entry] };
    }

    case 'APPROVE_ENTRY': {
      const entry = state.pendingQueue.find((e) => e.id === action.entryId);
      if (!entry) return state;
      return {
        ...state,
        pendingQueue: state.pendingQueue.filter((e) => e.id !== action.entryId),
        queue: updatePositions([...state.queue, { ...entry, status: 'waiting' }]),
      };
    }

    case 'REJECT_ENTRY':
      return {
        ...state,
        pendingQueue: state.pendingQueue.filter((e) => e.id !== action.entryId),
      };

    case 'START_PLAYING': {
      const entry = state.queue.find((e) => e.id === action.entryId);
      if (!entry) return state;
      const playing: QueueEntry = { ...entry, status: 'playing', startedAt: nowTime() };
      const prevHistory = state.currentPlaying
        ? [
            { ...state.currentPlaying, status: 'completed' as QueueStatus, finishedAt: nowTime() },
            ...state.history,
          ]
        : state.history;
      return {
        ...state,
        queue: updatePositions(state.queue.filter((e) => e.id !== action.entryId)),
        currentPlaying: playing,
        history: prevHistory,
      };
    }

    case 'FINISH_PLAYING':
    case 'SKIP_SONG': {
      if (!state.currentPlaying) return state;
      const closed: QueueEntry = {
        ...state.currentPlaying,
        status: action.type === 'FINISH_PLAYING' ? 'completed' : 'cancelled',
        finishedAt: nowTime(),
      };
      return { ...state, currentPlaying: null, history: [closed, ...state.history] };
    }

    case 'CANCEL_ENTRY': {
      const entry = state.queue.find((e) => e.id === action.entryId);
      if (!entry) return state;
      const cancelled: QueueEntry = { ...entry, status: 'cancelled', finishedAt: nowTime() };
      return {
        ...state,
        queue: updatePositions(state.queue.filter((e) => e.id !== action.entryId)),
        history: [cancelled, ...state.history],
      };
    }

    case 'MOVE_UP':
    case 'MOVE_DOWN': {
      const idx = state.queue.findIndex((e) => e.id === action.entryId);
      const target = action.type === 'MOVE_UP' ? idx - 1 : idx + 1;
      if (idx < 0 || target < 0 || target >= state.queue.length) return state;
      const q = [...state.queue];
      [q[idx], q[target]] = [q[target], q[idx]];
      return { ...state, queue: updatePositions(q) };
    }

    case 'MARK_NOTIFIED': {
      const stamp = nowTime();
      const marcar = (e: QueueEntry) => (e.id === action.entryId ? { ...e, notifiedAt: stamp } : e);
      return {
        ...state,
        queue: state.queue.map(marcar),
        pendingQueue: state.pendingQueue.map(marcar),
      };
    }

    // --- Telão ---
    case 'SET_TELAO_CONTENT': {
      const expiresAt = action.content.duration
        ? Date.now() + action.content.duration * 1000
        : null;
      return {
        ...state,
        telao: {
          ...state.telao,
          currentContent: action.content,
          timeRemaining: action.content.duration,
          expiresAt,
        },
      };
    }

    case 'CLEAR_TELAO_CONTENT':
      return {
        ...state,
        telao: { ...state.telao, currentContent: null, timeRemaining: null, expiresAt: null },
      };

    case 'TICK_TELAO': {
      // Conteúdo manual (sem duração) permanece até o Host encerrar.
      if (state.telao.expiresAt === null) return state;
      const remaining = Math.ceil((state.telao.expiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        return {
          ...state,
          telao: { ...state.telao, currentContent: null, timeRemaining: null, expiresAt: null },
        };
      }
      if (remaining === state.telao.timeRemaining) return state;
      return { ...state, telao: { ...state.telao, timeRemaining: remaining } };
    }

    case 'SET_TELAO_ONLINE':
      return { ...state, telao: { ...state.telao, isOnline: action.online } };

    case 'ADD_AD':
      return { ...state, telao: { ...state.telao, ads: [action.ad, ...state.telao.ads] } };

    case 'REMOVE_AD':
      return {
        ...state,
        telao: { ...state.telao, ads: state.telao.ads.filter((a) => a.id !== action.id) },
      };

    default:
      return state;
  }
}
