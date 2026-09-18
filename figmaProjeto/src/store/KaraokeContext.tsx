import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { QueueEntry, Song, QueueStatus, ScreenContent, TelaoState, Advertisement } from '../types';
import { INITIAL_QUEUE, INITIAL_HISTORY, INITIAL_PLAYING, MOCK_ADS } from '../data/mockData';

interface KaraokeState {
  queue: QueueEntry[];
  pendingQueue: QueueEntry[];
  history: QueueEntry[];
  currentPlaying: QueueEntry | null;
  telao: TelaoState;
}

type KaraokeAction =
  // Queue actions
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
  // Telão actions — future: replace dispatch with Supabase real-time updates
  | { type: 'SET_TELAO_CONTENT'; content: ScreenContent }
  | { type: 'CLEAR_TELAO_CONTENT' }
  | { type: 'TICK_TELAO' }
  | { type: 'SET_TELAO_ONLINE'; online: boolean }
  | { type: 'ADD_AD'; ad: Advertisement }
  | { type: 'REMOVE_AD'; id: string };

const initialTelao: TelaoState = {
  currentContent: null,
  timeRemaining: null,
  isOnline: true,
  ads: MOCK_ADS,
};

const initialState: KaraokeState = {
  queue: INITIAL_QUEUE,
  pendingQueue: [],
  history: INITIAL_HISTORY,
  currentPlaying: INITIAL_PLAYING,
  telao: initialTelao,
};

function updatePositions(queue: QueueEntry[]): QueueEntry[] {
  return queue.map((entry, index) => ({
    ...entry,
    status: (index === 0 ? 'next' : 'waiting') as QueueStatus,
  }));
}

function nowTime(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function reducer(state: KaraokeState, action: KaraokeAction): KaraokeState {
  switch (action.type) {
    // --- Queue ---
    case 'ADD_TO_QUEUE': {
      const entry: QueueEntry = {
        id: `q${Date.now()}`,
        participant: action.participant,
        phone: action.phone,
        song: action.song,
        requestedAt: nowTime(),
        status: state.queue.length === 0 ? 'next' : 'waiting',
      };
      return { ...state, queue: [...state.queue, entry] };
    }

    case 'PROPOSE_SONG': {
      const entry: QueueEntry = {
        id: `p${Date.now()}`,
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
      const approved: QueueEntry = {
        ...entry,
        status: state.queue.length === 0 ? 'next' : 'waiting',
      };
      const newPending = state.pendingQueue.filter((e) => e.id !== action.entryId);
      const newQueue = updatePositions([...state.queue, approved]);
      return { ...state, pendingQueue: newPending, queue: newQueue };
    }

    case 'REJECT_ENTRY': {
      const newPending = state.pendingQueue.filter((e) => e.id !== action.entryId);
      return { ...state, pendingQueue: newPending };
    }

    case 'START_PLAYING': {
      const entry = state.queue.find((e) => e.id === action.entryId);
      if (!entry) return state;
      const playing: QueueEntry = { ...entry, status: 'playing', startedAt: nowTime() };
      const remaining = updatePositions(state.queue.filter((e) => e.id !== action.entryId));
      const prevHistory = state.currentPlaying
        ? [
            { ...state.currentPlaying, status: 'completed' as QueueStatus, finishedAt: nowTime() },
            ...state.history,
          ]
        : state.history;
      return { ...state, queue: remaining, currentPlaying: playing, history: prevHistory };
    }

    case 'FINISH_PLAYING': {
      if (!state.currentPlaying) return state;
      const finished: QueueEntry = { ...state.currentPlaying, status: 'completed', finishedAt: nowTime() };
      return { ...state, currentPlaying: null, history: [finished, ...state.history] };
    }

    case 'SKIP_SONG': {
      if (!state.currentPlaying) return state;
      const skipped: QueueEntry = { ...state.currentPlaying, status: 'cancelled', finishedAt: nowTime() };
      return { ...state, currentPlaying: null, history: [skipped, ...state.history] };
    }

    case 'CANCEL_ENTRY': {
      const entry = state.queue.find((e) => e.id === action.entryId);
      if (!entry) return state;
      const cancelled: QueueEntry = { ...entry, status: 'cancelled', finishedAt: nowTime() };
      const newQueue = updatePositions(state.queue.filter((e) => e.id !== action.entryId));
      return { ...state, queue: newQueue, history: [cancelled, ...state.history] };
    }

    case 'MOVE_UP': {
      const idx = state.queue.findIndex((e) => e.id === action.entryId);
      if (idx <= 0) return state;
      const q = [...state.queue];
      [q[idx - 1], q[idx]] = [q[idx], q[idx - 1]];
      return { ...state, queue: updatePositions(q) };
    }

    case 'MOVE_DOWN': {
      const idx = state.queue.findIndex((e) => e.id === action.entryId);
      if (idx < 0 || idx >= state.queue.length - 1) return state;
      const q = [...state.queue];
      [q[idx], q[idx + 1]] = [q[idx + 1], q[idx]];
      return { ...state, queue: updatePositions(q) };
    }

    // --- Telão ---
    case 'SET_TELAO_CONTENT': {
      return {
        ...state,
        telao: {
          ...state.telao,
          currentContent: action.content,
          timeRemaining: action.content.duration,
        },
      };
    }

    case 'CLEAR_TELAO_CONTENT': {
      return {
        ...state,
        telao: { ...state.telao, currentContent: null, timeRemaining: null },
      };
    }

    case 'TICK_TELAO': {
      if (state.telao.timeRemaining === null) return state;
      const next = state.telao.timeRemaining - 1;
      if (next <= 0) {
        return {
          ...state,
          telao: { ...state.telao, currentContent: null, timeRemaining: null },
        };
      }
      return { ...state, telao: { ...state.telao, timeRemaining: next } };
    }

    case 'SET_TELAO_ONLINE': {
      return { ...state, telao: { ...state.telao, isOnline: action.online } };
    }

    case 'ADD_AD': {
      return { ...state, telao: { ...state.telao, ads: [action.ad, ...state.telao.ads] } };
    }

    case 'REMOVE_AD': {
      return {
        ...state,
        telao: { ...state.telao, ads: state.telao.ads.filter((a) => a.id !== action.id) },
      };
    }

    default:
      return state;
  }
}

interface KaraokeContextType {
  state: KaraokeState;
  dispatch: React.Dispatch<KaraokeAction>;
}

const KaraokeContext = createContext<KaraokeContextType | undefined>(undefined);

export function KaraokeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Telão countdown — lives inside the provider to avoid HMR context-split issues
  const timeRemaining = state.telao?.timeRemaining ?? null;
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;
    const timer = setTimeout(() => dispatch({ type: 'TICK_TELAO' }), 1000);
    return () => clearTimeout(timer);
  }, [timeRemaining]);

  return <KaraokeContext.Provider value={{ state, dispatch }}>{children}</KaraokeContext.Provider>;
}

export function useKaraoke() {
  const ctx = useContext(KaraokeContext);
  if (!ctx) throw new Error('useKaraoke must be used within KaraokeProvider');
  return ctx;
}
