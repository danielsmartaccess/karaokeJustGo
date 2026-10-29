import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createDemoState } from './demoData';
import { ComandaContext, type ComandaContextType } from './context';
import type { ComandaState } from './types';

/**
 * Estado das comandas (PROTÓTIPO, modo demonstração).
 *
 * Vive no navegador: persiste em localStorage e acompanha as outras abas do
 * MESMO navegador pelo evento `storage`. Isso permite abrir "Cliente" numa aba
 * e "Garçom" noutra e ver uma acompanhar a outra. Não há servidor: nada sai do
 * aparelho. Quando existir o banco, o provedor troca de fonte e a interface
 * continua a mesma.
 */

const STORAGE_KEY = 'jg-comanda:demo-v1';
const MY_TAB_KEY = 'jg-comanda:my-tab';
const SESSION_KEY = 'jg-comanda:staff';

function load(): ComandaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ComandaState;
  } catch {
    // armazenamento indisponível ou corrompido: recomeça da demonstração
  }
  return createDemoState(Date.now());
}

function save(state: ComandaState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sem armazenamento (modo privado): o estado segue vivo só na aba
  }
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignorado: ver `save`
  }
}

export function ComandaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ComandaState>(load);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [myTabId, setMyTab] = useState<string | null>(() => readKey(MY_TAB_KEY));
  const [staffId, setStaff] = useState<string | null>(() => readKey(SESSION_KEY));

  const replace = useCallback((next: ComandaState) => {
    stateRef.current = next;
    setState(next);
    save(next);
  }, []);

  const commit = useCallback<ComandaContextType['commit']>(
    (fn) => {
      const { state: next, result } = fn(stateRef.current, Date.now());
      if (next !== stateRef.current) replace(next);
      return result;
    },
    [replace],
  );

  const update = useCallback<ComandaContextType['update']>(
    (fn) => {
      const next = fn(stateRef.current);
      if (next !== stateRef.current) replace(next);
    },
    [replace],
  );

  const reset = useCallback(() => {
    replace(createDemoState(Date.now()));
    writeKey(MY_TAB_KEY, null);
    setMyTab(null);
  }, [replace]);

  // Acompanha as outras abas do mesmo navegador.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const next = JSON.parse(event.newValue) as ComandaState;
          stateRef.current = next;
          setState(next);
        } catch {
          // mensagem corrompida: ignora
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setMyTabId = useCallback((id: string | null) => {
    writeKey(MY_TAB_KEY, id);
    setMyTab(id);
  }, []);

  const setStaffId = useCallback((id: string | null) => {
    writeKey(SESSION_KEY, id);
    setStaff(id);
  }, []);

  return (
    <ComandaContext.Provider
      value={{ state, commit, update, reset, myTabId, setMyTabId, staffId, setStaffId }}
    >
      {children}
    </ComandaContext.Provider>
  );
}
