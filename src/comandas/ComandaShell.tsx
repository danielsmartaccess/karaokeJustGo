import type { ReactNode } from 'react';
import Logo from '../components/Logo';
import { useComandas } from './context';
import { PHONE_STATUS_CLASS, PHONE_STATUS_LABEL } from './format';
import type { PhoneStatus } from './types';

const PAPEIS = [
  { hash: '#/comanda', id: 'cliente', label: 'Cliente' },
  { hash: '#/garcom', id: 'garcom', label: 'Garçom' },
  { hash: '#/gerente', id: 'gerente', label: 'Gerente' },
] as const;

export type Papel = (typeof PAPEIS)[number]['id'];

/** Moldura comum das três telas, com o aviso de que isto é um protótipo. */
export function ComandaShell({
  papel,
  titulo,
  children,
  direita,
}: {
  papel: Papel;
  titulo: string;
  children: ReactNode;
  direita?: ReactNode;
}) {
  const { reset } = useComandas();

  return (
    <div className="min-h-screen bg-[#06000e] text-slate-200">
      <div
        data-testid="aviso-prototipo"
        className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex flex-wrap items-center gap-x-4 gap-y-1"
      >
        <span className="font-mono font-bold tracking-wider">PROTÓTIPO</span>
        <span>
          Dados de demonstração, guardados só neste navegador. Nada é enviado a um servidor.
        </span>
        <span className="flex items-center gap-1 sm:ml-auto">
          {PAPEIS.map((p) => (
            <a
              key={p.id}
              href={p.hash}
              className={`px-2.5 py-1 rounded-md border text-xs font-semibold ${
                p.id === papel
                  ? 'bg-amber-400 text-black border-amber-300'
                  : 'border-amber-500/40 text-amber-200 hover:bg-amber-500/20'
              }`}
            >
              {p.label}
            </a>
          ))}
          <button
            onClick={reset}
            className="ml-2 px-2.5 py-1 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 text-xs"
          >
            Reiniciar demonstração
          </button>
        </span>
      </div>

      <header className="px-5 py-4 border-b border-slate-800/80 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 min-w-0">
          <span className="whitespace-nowrap">
            <Logo size="sm" />
          </span>
          <h1 className="w-full sm:w-auto text-lg font-display font-black text-white">{titulo}</h1>
        </div>
        {direita}
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">{children}</main>
    </div>
  );
}

export function StatusChip({ status }: { status: PhoneStatus }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold ${PHONE_STATUS_CLASS[status]}`}
    >
      {PHONE_STATUS_LABEL[status]}
    </span>
  );
}
