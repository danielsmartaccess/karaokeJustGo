import { useState } from 'react';
import { ComandaShell, StatusChip } from './ComandaShell';
import { useComandas } from './context';
import { openTab, serviceDay, summarizeItems, totalUnits, type OpenTabFailure } from './rules';
import { cardClass, ghostButton, inputClass, primaryButton, primaryStyle } from './ui';

const MENSAGENS: Record<OpenTabFailure, string> = {
  'invalid-name': 'Informe seu nome.',
  'invalid-phone': 'Informe um celular válido com DDD, por exemplo 51 99999-0000.',
  'phone-already-open':
    'Este celular já tem uma comanda hoje. Chame o garçom para recuperar o acesso.',
  'daily-cap': 'Não foi possível abrir a comanda agora. Chame o garçom.',
};

/**
 * Tela do cliente: lê o QR, informa nome e celular e acompanha o consumo.
 * Sem login: a comanda fica ligada ao aparelho (no protótipo, por localStorage).
 */
export default function ClienteView() {
  const { state, commit, myTabId, setMyTabId } = useComandas();
  const hoje = serviceDay(Date.now());
  const minha = state.tabs.find((t) => t.id === myTabId) ?? null;

  const [nome, setNome] = useState('');
  const [celular, setCelular] = useState('');
  const [mesa, setMesa] = useState('');
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState('');

  const abrir = () => {
    setErro('');
    if (!aceito) {
      setErro('Aceite o aviso de privacidade para continuar.');
      return;
    }
    const r = commit((s, now) =>
      openTab(s, { name: nome, phone: celular, tableLabel: mesa, openedBy: 'cliente' }, now),
    );
    if (r.ok) setMyTabId(r.tab.id);
    else setErro(MENSAGENS[r.reason]);
  };

  // Comanda de outro dia: só vale no dia, então começa uma nova.
  if (minha && minha.serviceDay !== hoje) {
    return (
      <ComandaShell papel="cliente" titulo="Minha comanda">
        <div className={cardClass}>
          <p className="text-slate-300 text-sm mb-3">
            Sua comanda anterior era de outro dia e já não aceita itens. Cada dia tem uma comanda
            nova.
          </p>
          <button onClick={() => setMyTabId(null)} className={primaryButton} style={primaryStyle}>
            Abrir uma comanda de hoje
          </button>
        </div>
      </ComandaShell>
    );
  }

  if (minha) {
    const linhas = summarizeItems(state, minha.id);
    return (
      <ComandaShell papel="cliente" titulo="Minha comanda">
        <div className={`${cardClass} text-center mb-4`} data-testid="minha-comanda">
          <p className="text-xs font-mono tracking-[0.3em] text-pink-400 uppercase">Comanda</p>
          <p className="text-7xl font-display font-black text-white leading-none my-2">
            {minha.code}
          </p>
          <p className="text-slate-300">
            {minha.customerName}
            {minha.tableLabel ? ` · mesa ${minha.tableLabel}` : ''}
          </p>
          <div className="mt-2">
            <StatusChip status={minha.phoneStatus} />
          </div>
          {minha.phoneStatus === 'informado' && (
            <p className="text-amber-200/90 text-sm mt-3">
              Chame o garçom e diga o número da comanda para confirmar o seu celular.
            </p>
          )}
        </div>

        <div className={cardClass}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300">Consumo de hoje</h2>
            <span className="text-xs text-slate-500">
              {totalUnits(linhas)} {totalUnits(linhas) === 1 ? 'item' : 'itens'}
            </span>
          </div>
          {linhas.length === 0 ? (
            <p className="text-slate-500 text-sm">
              Nenhum item ainda. O garçom lança aqui e esta lista atualiza sozinha.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800" data-testid="consumo-cliente">
              {linhas.map((l) => (
                <li key={l.catalogItemId} className="flex items-center gap-3 py-2.5">
                  <span className="text-pink-400 font-mono font-bold w-10">{l.qty}×</span>
                  <span className="text-slate-200">{l.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 text-center">
          <button onClick={() => setMyTabId(null)} className={ghostButton}>
            Não sou {minha.customerName.split(' ')[0]} (sair)
          </button>
        </div>
      </ComandaShell>
    );
  }

  return (
    <ComandaShell papel="cliente" titulo="Abrir minha comanda">
      <div className={cardClass}>
        <p className="text-slate-400 text-sm mb-4">
          Informe seu nome e celular. O garçom vai confirmar o número com você na mesa.
        </p>
        <div className="space-y-3">
          <label className="block">
            <span className="block text-slate-400 text-sm mb-1.5">Nome</span>
            <input
              className={inputClass}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Ana"
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className="block text-slate-400 text-sm mb-1.5">Celular com DDD</span>
            <input
              className={inputClass}
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              placeholder="51 99999-0000"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label className="block">
            <span className="block text-slate-400 text-sm mb-1.5">
              Mesa ou onde você está sentado (opcional)
            </span>
            <input
              className={inputClass}
              value={mesa}
              onChange={(e) => setMesa(e.target.value)}
              placeholder="Ex.: mesa 4, balcão"
            />
          </label>
          <label className="flex items-start gap-2.5 text-xs text-slate-400 leading-snug">
            <input
              type="checkbox"
              checked={aceito}
              onChange={(e) => setAceito(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Declaro ser o titular do celular informado. Meu nome e celular ficam guardados pelo
              bar para a comanda e para contato operacional. Posso pedir a exclusão a qualquer
              momento.
            </span>
          </label>
          {erro && (
            <p role="alert" className="text-red-400 text-sm">
              {erro}
            </p>
          )}
          <button onClick={abrir} className={`${primaryButton} w-full`} style={primaryStyle}>
            Abrir minha comanda
          </button>
        </div>
      </div>
    </ComandaShell>
  );
}
