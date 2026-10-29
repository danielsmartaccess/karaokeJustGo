import { createContext, useContext } from 'react';
import type { Result } from './rules';
import type { ComandaState } from './types';

/** Contexto e hook das comandas; o provedor fica em ComandaContext.tsx. */
export interface ComandaContextType {
  state: ComandaState;
  /** Aplica uma regra pura ao estado atual e devolve o resultado dela. */
  commit: <T>(fn: (state: ComandaState, now: number) => Result<T>) => T;
  /** Aplica uma transformação simples (curadoria do catálogo, equipe). */
  update: (fn: (state: ComandaState) => ComandaState) => void;
  reset: () => void;
  myTabId: string | null;
  setMyTabId: (id: string | null) => void;
  staffId: string | null;
  setStaffId: (id: string | null) => void;
}

export const ComandaContext = createContext<ComandaContextType | undefined>(undefined);

export function useComandas() {
  const ctx = useContext(ComandaContext);
  if (!ctx) throw new Error('useComandas must be used within ComandaProvider');
  return ctx;
}
