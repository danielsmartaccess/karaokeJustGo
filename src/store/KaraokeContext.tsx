import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { KaraokeSnapshot } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  applyAction,
  ensureRoom,
  fetchSnapshot,
  subscribeToRoom,
} from '../services/karaokeRepository';
import { LOCAL_ONLY_ACTIONS, type KaraokeAction } from './actions';
import { demoState, emptyState, reducer } from './reducer';

/**
 * Estado compartilhado do karaoke.
 *
 * Dois modos, mesma interface para os componentes:
 *
 *   AO VIVO  - Supabase configurado. Cada acao e aplicada localmente (resposta
 *              imediata) e persistida; o realtime devolve o estado autoritativo
 *              para todos os dispositivos da sala.
 *   DEMO     - sem Supabase. Tudo vive na memoria da aba, com dados mockados.
 *              Serve para aula, apresentacao e desenvolvimento offline.
 */

export type ConnectionStatus = 'demo' | 'connecting' | 'live' | 'error';

interface KaraokeContextType {
  state: KaraokeSnapshot;
  dispatch: Dispatch<KaraokeAction>;
  connection: ConnectionStatus;
}

const KaraokeContext = createContext<KaraokeContextType | undefined>(undefined);

export function KaraokeProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(reducer, isSupabaseConfigured ? emptyState : demoState);
  const [connection, setConnection] = useState<ConnectionStatus>(
    isSupabaseConfigured ? 'connecting' : 'demo',
  );

  const roomIdRef = useRef<string | null>(null);
  // O repositório precisa do estado ANTERIOR à ação; um ref evita recriar
  // o dispatch a cada render e perder a identidade estável da função.
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * Ações disparadas antes da conexão terminar.
   *
   * O participante escaneia o QR e já digita: se a sala ainda não resolveu, a
   * solicitação dele seria aplicada só na tela e sumiria no primeiro realtime.
   * Guardamos e reenviamos na ordem assim que a sala estiver pronta.
   */
  const outboxRef = useRef<{ action: KaraokeAction; before: KaraokeSnapshot }[]>([]);

  // Conexão + carga inicial + realtime.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const reload = async () => {
      if (!roomIdRef.current) return;
      try {
        const snapshot = await fetchSnapshot(roomIdRef.current);
        if (active) baseDispatch({ type: 'HYDRATE', snapshot });
      } catch (error) {
        console.error('[karaoke] falha ao recarregar a sala', error);
      }
    };

    (async () => {
      try {
        const roomId = await ensureRoom();
        if (!active) return;
        roomIdRef.current = roomId;

        const queued = outboxRef.current;
        outboxRef.current = [];
        for (const { action, before } of queued) {
          try {
            await applyAction(roomId, action, before);
          } catch (error) {
            console.error('[karaoke] falha ao reenviar a acao', action.type, error);
          }
        }

        await reload();
        if (!active) return;
        unsubscribe = subscribeToRoom(roomId, () => void reload());
        setConnection('live');
      } catch (error) {
        console.error('[karaoke] nao foi possivel conectar ao Supabase', error);
        if (active) setConnection('error');
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const dispatch = useCallback<Dispatch<KaraokeAction>>((action) => {
    const before = stateRef.current;
    baseDispatch(action); // resposta imediata na interface

    if (!isSupabaseConfigured || LOCAL_ONLY_ACTIONS.has(action.type)) return;

    const roomId = roomIdRef.current;
    if (!roomId) {
      outboxRef.current.push({ action, before });
      return;
    }

    applyAction(roomId, action, before).catch((error) => {
      console.error('[karaoke] falha ao persistir a acao', action.type, error);
    });
  }, []);

  // Relógio do telão. Recalcula a partir de expiresAt, então todos os
  // dispositivos convergem sem precisar escrever no banco a cada segundo.
  const expiresAt = state.telao.expiresAt;
  useEffect(() => {
    if (expiresAt === null) return;
    const timer = setInterval(() => baseDispatch({ type: 'TICK_TELAO' }), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <KaraokeContext.Provider value={{ state, dispatch, connection }}>
      {children}
    </KaraokeContext.Provider>
  );
}

export function useKaraoke() {
  const ctx = useContext(KaraokeContext);
  if (!ctx) throw new Error('useKaraoke must be used within KaraokeProvider');
  return ctx;
}
