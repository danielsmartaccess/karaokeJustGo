import type { AppView } from '../types';
import { getComandaEnv } from './backend/env';
import { EnvContext } from './backend/hooks';
import ClienteView from './ClienteView';
import GarcomView from './GarcomView';
import GerenteView from './GerenteView';

/**
 * Rotas das comandas: um módulo só, carregado sob demanda pelo App. A fonte dos
 * dados (banco real ou demonstração) é escolhida em backend/env.ts.
 */
export default function ComandaApp({ view }: { view: AppView }) {
  return (
    <EnvContext.Provider value={getComandaEnv()}>
      {view === 'comanda' && <ClienteView />}
      {view === 'garcom' && <GarcomView />}
      {view === 'gerente' && <GerenteView />}
    </EnvContext.Provider>
  );
}
