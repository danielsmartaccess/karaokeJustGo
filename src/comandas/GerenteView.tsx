import { useState } from 'react';
import { ComandaShell, StatusChip } from './ComandaShell';
import { useComandas } from './context';
import { formatBRL, formatClock, formatPhone } from './format';
import {
  addCatalogItem,
  approveCatalogItem,
  archiveCatalogItem,
  mergeCatalogItem,
  normalizeName,
  parsePriceCents,
  renameCatalogItem,
  salesReport,
  serviceDay,
  setCatalogPrice,
  setStaffActive,
  summarizeItems,
  tabTotals,
  totalUnits,
  voidTab,
} from './rules';
import type { CatalogItem, StaffMember, Tab } from './types';
import { cardClass, ghostButton, inputClass, primaryButton, primaryStyle } from './ui';

type Aba = 'vendas' | 'consumo' | 'catalogo' | 'equipe';

function EntradaGerente({
  equipe,
  onEntrar,
}: {
  equipe: StaffMember[];
  onEntrar: (id: string) => void;
}) {
  const gerentes = equipe.filter((s) => s.role === 'gerente' && s.active);
  return (
    <ComandaShell papel="gerente" titulo="Gerente">
      <div className={cardClass}>
        <p className="text-slate-400 text-sm mb-4">
          Na versão real, o gerente entra com e-mail e senha, no celular ou no computador. Aqui,
          escolha quem você é:
        </p>
        <div className="space-y-2">
          {gerentes.map((g) => (
            <button
              key={g.id}
              onClick={() => onEntrar(g.id)}
              className={`${primaryButton} w-full`}
              style={primaryStyle}
            >
              Entrar como {g.name}
            </button>
          ))}
        </div>
      </div>
    </ComandaShell>
  );
}

function CartaoComanda({ tab }: { tab: Tab }) {
  const { state, commit } = useComandas();
  const [confirmar, setConfirmar] = useState(false);
  const linhas = summarizeItems(state, tab.id);
  const totais = tabTotals(state, tab.id);

  return (
    <article
      className={`${cardClass} ${tab.voidedAt ? 'opacity-50' : ''}`}
      data-testid={`comanda-${tab.code}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-white font-bold truncate">
            <span className="text-pink-400 font-display">#{tab.code}</span> {tab.customerName}
            {tab.voidedAt && <span className="text-red-400 text-xs ml-2">(anulada)</span>}
          </h3>
          <p className="text-xs text-slate-500">
            {tab.phone ? formatPhone(tab.phone) : 'sem celular'}
            {tab.tableLabel ? ` · mesa ${tab.tableLabel}` : ''} · aberta às{' '}
            {formatClock(tab.openedAt)}
          </p>
        </div>
        <StatusChip status={tab.phoneStatus} />
      </div>

      {linhas.length === 0 ? (
        <p className="text-slate-500 text-sm mt-3">Nenhum item.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {linhas.map((l) => (
            <li
              key={l.catalogItemId}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-sm"
            >
              <span className="text-pink-400 font-mono font-bold">{l.qty}×</span> {l.name}
              {l.totalCents > 0 && (
                <span className="text-slate-500"> · {formatBRL(l.totalCents)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-slate-500">
          {totalUnits(linhas)} itens
          {totais.unpricedUnits > 0 && (
            <span className="text-amber-300"> · {totais.unpricedUnits} sem preço</span>
          )}
          <strong className="ml-2 text-base text-white" data-testid={`total-${tab.code}`}>
            {formatBRL(totais.totalCents)}
          </strong>
        </span>
        {!tab.voidedAt &&
          (confirmar ? (
            <span className="flex gap-2">
              <button
                onClick={() => commit((s, now) => voidTab(s, tab.id, now))}
                className={`${ghostButton} border-red-500/50 text-red-300`}
              >
                Confirmar anulação
              </button>
              <button onClick={() => setConfirmar(false)} className={ghostButton}>
                Cancelar
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmar(true)} className={ghostButton}>
              Anular comanda
            </button>
          ))}
      </div>
    </article>
  );
}

function Consumo() {
  const { state } = useComandas();
  const hoje = serviceDay(Date.now());
  const dias = [...new Set([hoje, ...state.tabs.map((t) => t.serviceDay)])].sort().reverse();
  const [dia, setDia] = useState(hoje);
  const [busca, setBusca] = useState('');

  const q = normalizeName(busca);
  const digitos = busca.replace(/\D/g, '');
  const tabs = state.tabs
    .filter((t) => t.serviceDay === dia)
    .filter(
      (t) =>
        q === '' ||
        normalizeName(t.customerName).includes(q) ||
        (digitos !== '' && (String(t.code) === digitos || t.phone?.includes(digitos))),
    )
    .sort((a, b) => b.code - a.code);

  const validas = tabs.filter((t) => !t.voidedAt);
  const unidades = validas.reduce((sum, t) => sum + totalUnits(summarizeItems(state, t.id)), 0);
  const faturamento = validas.reduce((sum, t) => sum + tabTotals(state, t.id).totalCents, 0);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          className={`${inputClass} w-auto`}
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          aria-label="Dia de serviço"
        >
          {dias.map((d) => (
            <option key={d} value={d}>
              {d === hoje ? `Hoje (${d})` : d}
            </option>
          ))}
        </select>
        <input
          className={`${inputClass} flex-1 min-w-40`}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, número ou celular"
          aria-label="Buscar"
        />
      </div>

      <p className="text-sm text-slate-400 mb-3" data-testid="resumo-dia">
        {validas.length} {validas.length === 1 ? 'comanda' : 'comandas'} · {unidades} itens ·{' '}
        {formatBRL(faturamento)} (parcial, sujeito a conferência no caixa)
      </p>

      <div className="space-y-3">
        {tabs.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhuma comanda neste dia.</p>
        ) : (
          tabs.map((t) => <CartaoComanda key={t.id} tab={t} />)
        )}
      </div>
    </div>
  );
}

function NomeEditavel({ item }: { item: CatalogItem }) {
  const { update } = useComandas();
  const [nome, setNome] = useState(item.name);
  const salvar = () => {
    if (nome.trim() !== '' && nome.trim() !== item.name)
      update((s) => renameCatalogItem(s, item.id, nome));
    else setNome(item.name);
  };
  return (
    <input
      className={`${inputClass} py-2`}
      value={nome}
      onChange={(e) => setNome(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      aria-label={`Nome do item ${item.name}`}
    />
  );
}

/** Preço em reais digitado como o gerente fala ("12,50"); vazio tira o preço. */
function PrecoEditavel({ item }: { item: CatalogItem }) {
  const { update } = useComandas();
  const mostrado =
    item.priceCents === undefined ? '' : (item.priceCents / 100).toFixed(2).replace('.', ',');
  const [texto, setTexto] = useState(mostrado);
  const salvar = () => {
    const cents = parsePriceCents(texto);
    if (texto.trim() !== '' && cents === undefined) {
      setTexto(mostrado); // inválido: volta ao valor salvo
      return;
    }
    if (cents !== item.priceCents) update((s) => setCatalogPrice(s, item.id, cents));
    setTexto(cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ','));
  };
  return (
    <label className="flex items-center gap-1 text-xs text-slate-500">
      R$
      <input
        className={`${inputClass} py-2 w-20 text-right`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        placeholder="—"
        inputMode="decimal"
        aria-label={`Preço de ${item.name}`}
      />
    </label>
  );
}

function Vendas() {
  const { state } = useComandas();
  const hoje = serviceDay(Date.now());
  const dias = [...new Set([hoje, ...state.tabs.map((t) => t.serviceDay)])].sort().reverse();
  const [dia, setDia] = useState(hoje);
  const r = salesReport(state, dia);
  const maxUnidades = r.top[0]?.units ?? 1;

  return (
    <div className="space-y-4" data-testid="vendas">
      <select
        className={`${inputClass} w-auto`}
        value={dia}
        onChange={(e) => setDia(e.target.value)}
        aria-label="Dia das vendas"
      >
        {dias.map((d) => (
          <option key={d} value={d}>
            {d === hoje ? `Hoje (${d})` : d}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        {[
          ['Faturamento (parcial)', formatBRL(r.revenueCents), 'faturamento'],
          ['Ticket médio', formatBRL(r.avgTicketCents), 'ticket-medio'],
          ['Comandas', String(r.tabs), 'comandas'],
          ['Itens por comanda', r.unitsPerTab.toFixed(1).replace('.', ','), 'itens-por-comanda'],
        ].map(([rotulo, valor, id]) => (
          <div key={id} className={cardClass}>
            <p className="text-xs text-slate-500">{rotulo}</p>
            <p className="text-2xl font-display font-black text-white" data-testid={`kpi-${id}`}>
              {valor}
            </p>
          </div>
        ))}
      </div>

      {r.unpricedUnits > 0 && (
        <div
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"
          data-testid="alerta-sem-preco"
        >
          <strong>{r.unpricedUnits}</strong>{' '}
          {r.unpricedUnits === 1 ? 'unidade vendida' : 'unidades vendidas'} sem preço (
          {r.unpricedItems.map((i) => `${i.units}× ${i.name}`).join(', ')}). Defina o preço na aba
          Catálogo para o faturamento fechar.
        </div>
      )}

      <section className={cardClass}>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Mais vendidos</h2>
        {r.top.length === 0 ? (
          <p className="text-slate-500 text-sm">Sem vendas neste dia.</p>
        ) : (
          <ul className="space-y-2" data-testid="mais-vendidos">
            {r.top.map((l) => (
              <li key={l.catalogItemId}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-200">{l.name}</span>
                  <span className="text-slate-400">
                    {l.units}× · {formatBRL(l.revenueCents)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 mt-1">
                  <div
                    className="h-full rounded-full bg-pink-500"
                    style={{ width: `${(l.units / maxUnidades) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-600">
        Valores parciais: refletem o que foi lançado, sem taxa de serviço, desconto ou cortesia.
        Quem fecha a conta continua sendo o caixa.
      </p>
    </div>
  );
}

function Catalogo() {
  const { state, update } = useComandas();
  const [novo, setNovo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [preco, setPreco] = useState('');

  const vivos = state.catalog.filter((c) => !c.mergedInto);
  const sugeridos = vivos.filter((c) => c.status === 'suggested');
  const aprovados = vivos
    .filter((c) => c.status === 'approved')
    .sort((a, b) => b.useCount - a.useCount);
  const arquivados = vivos.filter((c) => c.status === 'archived');

  return (
    <div className="space-y-5">
      <section className={cardClass}>
        <h2 className="text-sm font-semibold text-amber-300 mb-1">
          Sugeridos pelos garçons ({sugeridos.length})
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Itens digitados na hora. Já aparecem para todos os garçons; aprove, renomeie ou junte com
          um item existente para não duplicar.
        </p>
        {sugeridos.length === 0 ? (
          <p className="text-slate-500 text-sm">Nada para curar.</p>
        ) : (
          <div className="space-y-3" data-testid="sugeridos">
            {sugeridos.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-800 p-3">
                <NomeEditavel item={c} />
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <PrecoEditavel item={c} />
                  <button
                    onClick={() => update((s) => approveCatalogItem(s, c.id))}
                    className={`${ghostButton} border-green-500/50 text-green-300`}
                  >
                    Aprovar
                  </button>
                  <select
                    className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300"
                    value=""
                    onChange={(e) =>
                      e.target.value && update((s) => mergeCatalogItem(s, c.id, e.target.value))
                    }
                    aria-label={`Juntar ${c.name} com`}
                  >
                    <option value="">Juntar com…</option>
                    {aprovados.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => update((s) => archiveCatalogItem(s, c.id))}
                    className={ghostButton}
                  >
                    Arquivar
                  </button>
                  <span className="text-xs text-slate-600 ml-auto">{c.useCount} usos</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          Aprovados ({aprovados.length})
        </h2>
        <ul className="divide-y divide-slate-800" data-testid="aprovados">
          {aprovados.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <span className="text-xs text-slate-600 w-16 shrink-0">{c.category}</span>
              <span className="flex-1 min-w-0">
                <NomeEditavel item={c} />
              </span>
              <PrecoEditavel item={c} />
              <span className="text-xs text-slate-600 w-14 text-right">{c.useCount} usos</span>
              <button
                onClick={() => update((s) => archiveCatalogItem(s, c.id))}
                className={ghostButton}
              >
                Arquivar
              </button>
            </li>
          ))}
        </ul>
        {arquivados.length > 0 && (
          <p className="text-xs text-slate-600 mt-3">{arquivados.length} item(ns) arquivado(s)</p>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Novo item</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${inputClass} flex-1 min-w-40`}
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Nome do item"
            aria-label="Nome do novo item"
          />
          <input
            className={`${inputClass} w-36`}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Categoria"
            aria-label="Categoria"
          />
          <input
            className={`${inputClass} w-28`}
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            placeholder="Preço"
            inputMode="decimal"
            aria-label="Preço do novo item"
          />
          <button
            onClick={() => {
              update((s) => addCatalogItem(s, novo, categoria, parsePriceCents(preco)));
              setNovo('');
              setCategoria('');
              setPreco('');
            }}
            className={primaryButton}
            style={primaryStyle}
          >
            Adicionar
          </button>
        </div>
      </section>
    </div>
  );
}

function Equipe() {
  const { state, update } = useComandas();
  return (
    <section className={cardClass}>
      <p className="text-xs text-slate-500 mb-3">
        Quem cria a conta fica pendente até você ativar. Quem não está ativo não vê nenhuma comanda.
      </p>
      <ul className="divide-y divide-slate-800">
        {state.staff.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <span className="flex-1 min-w-0">
              <span className="block text-slate-100 font-semibold">{s.name}</span>
              <span className="block text-xs text-slate-500">
                {s.role === 'gerente' ? 'Gerente' : 'Garçom'} · {s.email}
              </span>
            </span>
            <span className={`text-xs ${s.active ? 'text-green-400' : 'text-amber-300'}`}>
              {s.active ? 'Ativo' : 'Pendente'}
            </span>
            <button
              onClick={() => update((st) => setStaffActive(st, s.id, !s.active))}
              className={ghostButton}
            >
              {s.active ? 'Desativar' : 'Ativar'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function GerenteView() {
  const { state, staffId, setStaffId } = useComandas();
  const [aba, setAba] = useState<Aba>('vendas');

  const eu = state.staff.find((s) => s.id === staffId && s.active && s.role === 'gerente');
  if (!eu) return <EntradaGerente equipe={state.staff} onEntrar={setStaffId} />;

  const abas: { id: Aba; label: string }[] = [
    { id: 'vendas', label: 'Vendas' },
    { id: 'consumo', label: 'Comandas' },
    { id: 'catalogo', label: 'Catálogo' },
    { id: 'equipe', label: 'Equipe' },
  ];
  const pendentes = state.staff.filter((s) => !s.active).length;

  return (
    <ComandaShell
      papel="gerente"
      titulo={`Gerente · ${eu.name}`}
      direita={
        <button onClick={() => setStaffId(null)} className={ghostButton}>
          Sair
        </button>
      }
    >
      <div
        className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4"
        role="tablist"
      >
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${
              aba === a.id
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                : 'text-slate-500'
            }`}
          >
            {a.label}
            {a.id === 'equipe' && pendentes > 0 && (
              <span className="ml-1.5 text-[10px] bg-amber-400 text-black rounded-full px-1.5">
                {pendentes}
              </span>
            )}
          </button>
        ))}
      </div>

      {aba === 'vendas' && <Vendas />}
      {aba === 'consumo' && <Consumo />}
      {aba === 'catalogo' && <Catalogo />}
      {aba === 'equipe' && <Equipe />}
    </ComandaShell>
  );
}
