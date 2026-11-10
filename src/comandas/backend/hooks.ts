import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ComandaEnv } from './env';
import type { ComandaBackend } from './types';

export const EnvContext = createContext<ComandaEnv | undefined>(undefined);

export function useEnv(): ComandaEnv {
  const env = useContext(EnvContext);
  if (!env) throw new Error('useEnv must be used within ComandaApp');
  return env;
}

export function useBackend(): ComandaBackend {
  return useEnv().backend;
}

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Busca de novo agora (use depois de uma ação que mudou algo). */
  reload: () => Promise<void>;
}

interface QueryOptions {
  /** Consulta de novo a cada tantos ms (ao vivo não há evento de mudança). */
  every?: number;
  enabled?: boolean;
}

/**
 * Consulta que se atualiza sozinha: ao montar, quando a fonte avisa que algo mudou
 * (outra aba, na demonstração) e em intervalo curto (ao vivo). Mantém o dado
 * anterior enquanto busca (sem piscar) e descarta respostas atrasadas.
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  { every, enabled = true }: QueryOptions = {},
): QueryState<T> {
  const backend = useBackend();
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({
    loading: true,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const sequence = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++sequence.current;
    try {
      const data = await fetcherRef.current();
      if (mine === sequence.current) setState({ data, loading: false });
    } catch (error) {
      if (mine === sequence.current) setState((s) => ({ data: s.data, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    const unsubscribe = backend.subscribe(() => void reload());
    const timer = every
      ? setInterval(() => {
          if (!document.hidden) void reload();
        }, every)
      : undefined;
    return () => {
      sequence.current += 1; // descarta o que ainda estiver a caminho
      unsubscribe();
      if (timer) clearInterval(timer);
    };
    // `deps` é a lista de dependências da própria consulta, definida por quem chama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, reload, every, enabled, ...deps]);

  return { data: state.data, error: state.error, loading: state.loading, reload };
}
