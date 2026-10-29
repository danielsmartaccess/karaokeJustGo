import type { AppView } from '../types';
import { ComandaProvider } from './ComandaContext';
import ClienteView from './ClienteView';
import GarcomView from './GarcomView';
import GerenteView from './GerenteView';

/** Rotas das comandas: um módulo só, carregado sob demanda pelo App. */
export default function ComandaApp({ view }: { view: AppView }) {
  return (
    <ComandaProvider>
      {view === 'comanda' && <ClienteView />}
      {view === 'garcom' && <GarcomView />}
      {view === 'gerente' && <GerenteView />}
    </ComandaProvider>
  );
}
