import { useEffect, useState } from 'react';
import { ComandaShell, StatusChip } from './ComandaShell';
import { useComandas } from './context';
import { formatClock, maskedPhone } from './format';
import {
  addItem,
  confirmPhone,
  findTabs,
  normalizeName,
  openTab,
  parseQuickEntry,
  reverseItem,
  searchCatalog,
  serviceDay,
  summarizeItems,
  totalUnits,
} from './rules';
import type { StaffMember, Tab } from './types';
import { cardClass, ghostButton, inputClass, primaryButton, primaryStyle } from './ui';

/** Login de demonstração: escolhe um garçom ativo. Na versão real, e-mail e senha. */
function EntradaGarcom({
  equipe,
  onEntrar,
}: {
  equipe: StaffMember[];
  onEntrar: (id: string) => void;
}) {
  const garcons = equipe.filter((s) => s.role === 'garcom');
  return (
    <ComandaShell papel="garcom" titulo="Garçom">
      <div className={cardClass}>
        <p className="text-slate-400 text-sm mb-4">
          Na versão real, o garçom entra com e-mail e senha e o gerente ativa o acesso. Aqui,
          escolha quem você é:
        </p>
        <div className="space-y-2">
          {garcons.map((g) =>
            g.active ? (
              <button
                key={g.id}
                onClick={() => onEntrar(g.id)}
                className={`${primaryButton} w-full`}
                style={primaryStyle}
              >
                Entrar como {g.name}
              </button>
            ) : (
              <div
                key={g.id}
                className="px-4 py-3 rounded-xl border border-slate-800 text-slate-500 text-sm"
              >
                {g.name}: aguardando o gerente ativar o acesso
              </div>
            ),
          )}
        </div>
      </div>
    </ComandaShell>
  );
}

function LinhaComanda({
  tab,
  selecionada,
  onClick,
}: {
  tab: Tab;
  selecionada: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        selecionada
          ? 'bg-pink-500/10 border-pink-500/50'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
      }`}
    >
      <span className="text-2xl font-display font-black text-pink-400 w-12 text-center">
        {tab.code}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-slate-100 font-semibold truncate">{tab.customerName}</span>
        <span className="block text-xs text-slate-500">
          {maskedPhone(tab.phoneLast4)}
          {tab.tableLabel ? ` · mesa ${tab.tableLabel}` : ''}
        </span>
      </span>
      <StatusChip status={tab.phoneStatus} />
    </button>
  );
}

function PainelComanda({ tab, garcom }: { tab: Tab; garcom: StaffMember }) {
  const { state, commit } = useComandas();
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState('');

  // O aviso some sozinho.
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 2500);
    return () => clearTimeout(t);
  }, [aviso]);

  const { qty, term } = parseQuickEntry(texto);
  const sugestoes = searchCatalog(state.catalog, term);
  const resumo = summarizeItems(state, tab.id);
  const linhas = state.items
    .filter((i) => i.tabId === tab.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  const jaEstornados = new Set(linhas.filter((l) => l.reversesItemId).map((l) => l.reversesItemId));
  const exato = sugestoes.some((s) => s.normalized === normalizeName(term));

  const lancar = (catalogItemId: string | undefined, nome: string | undefined) => {
    const r = commit((s, now) =>
      addItem(s, { tabId: tab.id, catalogItemId, name: nome, qty, by: garcom.name }, now),
    );
    if (r.ok) {
      setAviso(
        `Lançado: ${qty}× ${r.item.nameSnapshot}${r.created ? ' (novo item, vai para curadoria)' : ''}`,
      );
      setTexto('');
    } else {
      setAviso('Não foi possível lançar: esta comanda não aceita itens agora.');
    }
  };

  const enter = () => {
    if (term.trim() === '') return;
    if (sugestoes[0]) lancar(sugestoes[0].id, undefined);
    else lancar(undefined, term);
  };

  return (
    <div className={`${cardClass} mt-4`} data-testid="painel-comanda">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-mono text-pink-400 tracking-widest uppercase">
            Comanda {tab.code}
          </p>
          <h2 className="text-xl font-display font-black text-white">{tab.customerName}</h2>
          <p className="text-xs text-slate-500">
            {maskedPhone(tab.phoneLast4)}
            {tab.tableLabel ? ` · mesa ${tab.tableLabel}` : ''}
          </p>
        </div>
        <StatusChip status={tab.phoneStatus} />
      </div>

      {tab.phoneStatus === 'informado' && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 mb-4">
          <p className="text-amber-200 text-sm mb-2">
            Peça ao cliente os <strong>4 últimos dígitos</strong> do celular e compare com{' '}
            <strong className="font-mono">{tab.phoneLast4}</strong>.
          </p>
          <button
            onClick={() => commit((s) => confirmPhone(s, tab.id))}
            className={primaryButton}
            style={primaryStyle}
          >
            Confirmar celular
          </button>
        </div>
      )}

      <label className="block mb-2">
        <span className="block text-slate-400 text-sm mb-1.5">
          Item (ex.: <span className="font-mono">3 chopp</span> lança 3 de uma vez)
        </span>
        <input
          className={inputClass}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enter()}
          placeholder="Digite o item..."
          aria-label="Item"
          autoComplete="off"
        />
      </label>

      <div className="flex flex-wrap gap-2 mb-2" data-testid="sugestoes">
        {sugestoes.map((s) => (
          <button
            key={s.id}
            onClick={() => lancar(s.id, undefined)}
            className="px-3 py-2 rounded-xl text-sm font-semibold bg-pink-500/15 hover:bg-pink-500/30 text-pink-200 border border-pink-500/40"
          >
            {qty > 1 ? `${qty}× ` : ''}
            {s.name}
            {s.status === 'suggested' && (
              <span className="text-amber-300/80 text-[10px]"> · sugerido</span>
            )}
          </button>
        ))}
        {term.trim() !== '' && !exato && (
          <button
            onClick={() => lancar(undefined, term)}
            className="px-3 py-2 rounded-xl text-sm border border-dashed border-slate-500 text-slate-300 hover:bg-slate-800"
          >
            Adicionar “{term.trim()}” como novo item
          </button>
        )}
      </div>

      <p role="status" className="min-h-5 text-green-400 text-sm mb-2">
        {aviso}
      </p>

      <div className="border-t border-slate-800 pt-3">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300">Consumo</h3>
          <span className="text-xs text-slate-500">{totalUnits(resumo)} itens</span>
        </div>
        {resumo.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum item lançado.</p>
        ) : (
          <ul className="mb-3 flex flex-wrap gap-2" data-testid="resumo-garcom">
            {resumo.map((l) => (
              <li
                key={l.catalogItemId}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-sm"
              >
                <span className="text-pink-400 font-mono font-bold">{l.qty}×</span> {l.name}
              </li>
            ))}
          </ul>
        )}

        {linhas.length > 0 && (
          <details>
            <summary className="text-xs text-slate-500 cursor-pointer">
              Lançamentos ({linhas.length})
            </summary>
            <ul className="mt-2 divide-y divide-slate-800 text-sm">
              {linhas.map((l) => (
                <li key={l.id} className="flex items-center gap-2 py-2">
                  <span className="text-slate-600 font-mono text-xs w-11">
                    {formatClock(l.createdAt)}
                  </span>
                  <span
                    className={`flex-1 ${
                      l.qty < 0 || jaEstornados.has(l.id)
                        ? 'text-slate-600 line-through'
                        : 'text-slate-300'
                    }`}
                  >
                    {l.qty > 0 ? '+' : ''}
                    {l.qty} {l.nameSnapshot}
                    {l.qty < 0 && ' (estorno)'}
                  </span>
                  {l.qty > 0 && !jaEstornados.has(l.id) && (
                    <button
                      onClick={() => commit((s, now) => reverseItem(s, l.id, garcom.name, now))}
                      className={ghostButton}
                    >
                      Estornar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

/** Contingência: abre a comanda só com nome e mesa, sem celular. */
function AbrirSemCelular({ onAberta }: { onAberta: (id: string) => void }) {
  const { commit } = useComandas();
  const [nome, setNome] = useState('');
  const [mesa, setMesa] = useState('');
  const [erro, setErro] = useState('');

  const abrir = () => {
    const r = commit((s, now) =>
      openTab(s, { name: nome, tableLabel: mesa, openedBy: 'garcom' }, now),
    );
    if (r.ok) {
      setNome('');
      setMesa('');
      setErro('');
      onAberta(r.tab.id);
    } else {
      setErro('Informe o nome do cliente.');
    }
  };

  return (
    <details className="mt-3">
      <summary className="text-sm text-slate-400 cursor-pointer">
        Cliente sem celular? Abrir comanda só com nome e mesa
      </summary>
      <div className="flex flex-wrap gap-2 mt-2">
        <input
          className={`${inputClass} flex-1 min-w-40`}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome"
          aria-label="Nome do cliente"
        />
        <input
          className={`${inputClass} w-32`}
          value={mesa}
          onChange={(e) => setMesa(e.target.value)}
          placeholder="Mesa"
          aria-label="Mesa"
        />
        <button onClick={abrir} className={primaryButton} style={primaryStyle}>
          Abrir
        </button>
      </div>
      {erro && <p className="text-red-400 text-sm mt-1">{erro}</p>}
    </details>
  );
}

export default function GarcomView() {
  const { state, staffId, setStaffId } = useComandas();
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const eu = state.staff.find((s) => s.id === staffId && s.active && s.role === 'garcom');
  if (!eu) return <EntradaGarcom equipe={state.staff} onEntrar={setStaffId} />;

  const hoje = serviceDay(Date.now());
  const resultados = findTabs(state, busca, hoje);
  const tab = state.tabs.find((t) => t.id === selecionada && t.serviceDay === hoje && !t.voidedAt);

  return (
    <ComandaShell
      papel="garcom"
      titulo={`Garçom · ${eu.name}`}
      direita={
        <button onClick={() => setStaffId(null)} className={ghostButton}>
          Sair
        </button>
      }
    >
      <label className="block">
        <span className="block text-slate-400 text-sm mb-1.5">
          Buscar comanda: número, 4 últimos dígitos do celular ou nome
        </span>
        <input
          className={inputClass}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Ex.: 2, 0202 ou Ana"
          aria-label="Buscar comanda"
          autoComplete="off"
        />
      </label>

      <div className="mt-3 space-y-2" data-testid="resultados">
        {resultados.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhuma comanda de hoje encontrada.</p>
        ) : (
          resultados.map((t) => (
            <LinhaComanda
              key={t.id}
              tab={t}
              selecionada={t.id === tab?.id}
              onClick={() => setSelecionada(t.id)}
            />
          ))
        )}
      </div>

      <AbrirSemCelular onAberta={setSelecionada} />

      {tab && <PainelComanda key={tab.id} tab={tab} garcom={eu} />}
    </ComandaShell>
  );
}
