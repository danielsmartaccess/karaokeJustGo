import { useEffect, useState } from 'react';
import { Minus, Plus, Undo2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useBackend, useQuery } from './backend/hooks';
import { errorMessage } from './backend/messages';
import type { MenuItem, TabDetail, TabListItem } from './backend/types';
import { ComandaShell, StatusChip } from './ComandaShell';
import { formatBRL, formatClock, formatPrice, maskedPhone } from './format';
import { normalizeName, parseQuickEntry } from './rules';
import { StaffGate, type StaffSession } from './StaffGate';
import { cardClass, ghostButton, inputClass, primaryButton, primaryStyle } from './ui';

const POLL_MS = 6000;

// --- Cardápio no aparelho (a lista vem pronta do servidor) ---------------------------

interface MenuGroup {
  category: string;
  items: MenuItem[];
}

/** Itens por categoria; a categoria e os itens mais vendidos vêm primeiro. */
function groupMenu(menu: MenuItem[]): MenuGroup[] {
  const groups = new Map<string, MenuItem[]>();
  for (const m of menu) groups.set(m.category, [...(groups.get(m.category) ?? []), m]);
  const use = (items: MenuItem[]) => items.reduce((sum, m) => sum + m.useCount, 0);
  return [...groups.entries()]
    .map(([category, items]) => ({
      category,
      items: [...items].sort(
        (a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name, 'pt-BR'),
      ),
    }))
    .sort((a, b) => use(b.items) - use(a.items) || a.category.localeCompare(b.category, 'pt-BR'));
}

/** Autocomplete do digitado: tolerante a acento e abreviação ("chop" acha "Chopp"). */
function searchMenu(menu: MenuItem[], term: string, limit = 8): MenuItem[] {
  const tokens = normalizeName(term).split(' ').filter(Boolean);
  return menu
    .map((m) => ({ m, norm: normalizeName(m.name) }))
    .filter(({ norm }) => tokens.every((t) => norm.includes(t)))
    .map(({ m, norm }) => {
      let rank = 3;
      if (tokens.length > 0) {
        if (norm.startsWith(tokens[0])) rank = 0;
        else if (norm.split(' ').some((w) => w.startsWith(tokens[0]))) rank = 1;
        else rank = 2;
      }
      return { m, rank };
    })
    .sort(
      (a, b) =>
        a.rank - b.rank || b.m.useCount - a.m.useCount || a.m.name.localeCompare(b.m.name, 'pt-BR'),
    )
    .slice(0, limit)
    .map((s) => s.m);
}

// --- Telas -------------------------------------------------------------------------------

function LinhaComanda({ tab, onClick }: { tab: TabListItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors bg-slate-900/60 border-slate-800 hover:border-slate-600"
    >
      <span className="text-2xl font-display font-black text-pink-400 w-12 text-center">
        {tab.code}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-slate-100 font-semibold truncate">{tab.customerName}</span>
        <span className="block text-xs text-slate-500">
          {maskedPhone(tab.phoneLast4)}
          {tab.tableLabel ? ` · mesa ${tab.tableLabel}` : ''}
          {tab.status === 'conta_pedida' && ' · conta pedida'}
          {tab.status === 'fechada' && ' · fechada'}
        </span>
      </span>
      <StatusChip status={tab.phoneStatus} />
    </button>
  );
}

interface UltimoLancamento {
  itemId: string;
  texto: string;
}

function PainelComanda({
  tab,
  garcom,
  menu,
}: {
  tab: TabListItem;
  garcom: StaffSession;
  menu: MenuItem[];
}) {
  const backend = useBackend();
  const detail = useQuery(() => backend.getTab(tab.id), [tab.id], { every: POLL_MS });
  const d: TabDetail | undefined = detail.data;
  const units = d?.units ?? 0;
  const pairings = useQuery(() => backend.suggestPairings(tab.id, 3), [tab.id, units], {
    enabled: d !== undefined,
  });

  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [ultimo, setUltimo] = useState<UltimoLancamento | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [acesso, setAcesso] = useState<string | null>(null);

  // O aviso e o "Desfazer" somem sozinhos.
  useEffect(() => {
    if (!aviso && !ultimo) return;
    const t = setTimeout(() => {
      setAviso('');
      setUltimo(null);
    }, 6000);
    return () => clearTimeout(t);
  }, [aviso, ultimo]);

  const status = d?.status ?? tab.status;
  const aberta = status === 'aberta' || status === 'conta_pedida';
  const { qty, term } = parseQuickEntry(texto);
  const sugestoes = term.trim() === '' ? [] : searchMenu(menu, term);
  const exato = sugestoes.some((s) => normalizeName(s.name) === normalizeName(term));
  const cardapio = groupMenu(menu);
  const ativa = cardapio.find((c) => c.category === categoria) ?? cardapio[0];
  const naComanda = new Map((d?.lines ?? []).map((l) => [l.catalogItemId, l.qty]));

  /** Roda uma ação, mostra o erro em português se falhar e atualiza a comanda. */
  const agir = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setErro('');
    try {
      const r = await fn();
      await detail.reload();
      return r;
    } catch (e) {
      setErro(errorMessage(e));
      return undefined;
    }
  };

  const lancar = async (catalogItemId: string | undefined, nome: string | undefined, n = 1) => {
    const r = await agir(() =>
      backend.addItem({ tabId: tab.id, catalogItemId, name: nome, qty: n }),
    );
    if (!r) {
      setAviso('');
      setUltimo(null);
      return false;
    }
    const descricao = `${n}× ${r.name}`;
    setAviso(`Lançado: ${descricao}${r.created ? ' (novo item, vai para curadoria)' : ''}`);
    setUltimo({ itemId: r.itemId, texto: descricao });
    return true;
  };

  const lancarDigitado = async (catalogItemId: string | undefined, nome: string | undefined) => {
    if (await lancar(catalogItemId, nome, qty)) setTexto('');
  };

  const enter = () => {
    if (term.trim() === '') return;
    if (sugestoes[0]) void lancarDigitado(sugestoes[0].id, undefined);
    else void lancarDigitado(undefined, term);
  };

  const tirarUm = async (item: MenuItem) => {
    const ok = await agir(() => backend.removeOne(tab.id, item.id));
    setAviso(ok ? `Tirado: 1× ${item.name}` : '');
    setUltimo(null);
  };

  const desfazer = async () => {
    if (!ultimo) return;
    await agir(() => backend.reverseItem(ultimo.itemId));
    setAviso(`Desfeito: ${ultimo.texto}`);
    setUltimo(null);
  };

  const recuperarAcesso = async () => {
    const r = await agir(() => backend.reissueSecret(tab.id));
    if (r) {
      const url = new URL(window.location.href);
      url.search = `?t=${encodeURIComponent(r.tabId)}&s=${encodeURIComponent(r.secret)}`;
      url.hash = '#/comanda';
      setAcesso(url.toString());
    }
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
        <div className="text-right">
          <p className="text-2xl font-display font-black text-white" data-testid="total-comanda">
            {formatBRL(
              d ? (status === 'fechada' ? (d.closedTotalCents ?? d.totalCents) : d.totalCents) : 0,
            )}
          </p>
          <p className="text-xs text-slate-500">
            {units} {units === 1 ? 'item' : 'itens'}
            {(d?.unpricedUnits ?? 0) > 0 && (
              <span className="text-amber-300"> · {d?.unpricedUnits} sem preço</span>
            )}
          </p>
          <div className="mt-1">
            <StatusChip status={d?.phoneStatus ?? tab.phoneStatus} />
          </div>
        </div>
      </div>

      {status === 'conta_pedida' && (
        <p
          className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-2.5 mb-3 text-sky-200 text-sm"
          data-testid="aviso-conta-pedida"
        >
          A mesa pediu a conta. O gerente já foi avisado.
        </p>
      )}
      {status === 'fechada' && (
        <p className="rounded-xl border border-green-500/40 bg-green-500/10 p-2.5 mb-3 text-green-200 text-sm">
          Conta fechada pelo gerente: não aceita mais itens.
        </p>
      )}

      {(d?.phoneStatus ?? tab.phoneStatus) === 'informado' && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 mb-4">
          <p className="text-amber-200 text-sm mb-2">
            Peça ao cliente os <strong>4 últimos dígitos</strong> do celular e compare com{' '}
            <strong className="font-mono">{tab.phoneLast4}</strong>.
          </p>
          <button
            onClick={() => void agir(() => backend.confirmPhone(tab.id))}
            className={primaryButton}
            style={primaryStyle}
          >
            Confirmar celular
          </button>
        </div>
      )}

      {erro && (
        <p role="alert" className="text-red-400 text-sm mb-2">
          {erro}
        </p>
      )}

      {/* Aviso e desfazer ficam logo acima do cardápio: o erro se corrige no mesmo lugar do toque. */}
      <div className="flex items-center gap-2 min-h-10 mb-2" role="status">
        <span className="flex-1 text-green-400 text-sm">{aviso}</span>
        {ultimo && (
          <button
            onClick={() => void desfazer()}
            className={`${ghostButton} inline-flex items-center gap-1.5 border-green-500/50 text-green-300`}
          >
            <Undo2 size={14} aria-hidden /> Desfazer
          </button>
        )}
      </div>

      {aberta && (
        <>
          <div
            className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1"
            role="tablist"
            aria-label="Categorias do cardápio"
          >
            {cardapio.map((c) => (
              <button
                key={c.category}
                role="tab"
                aria-selected={c.category === ativa?.category}
                onClick={() => setCategoria(c.category)}
                className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold border ${
                  c.category === ativa?.category
                    ? 'bg-pink-500/20 text-pink-200 border-pink-500/50'
                    : 'text-slate-400 border-slate-700 hover:bg-slate-800'
                }`}
              >
                {c.category}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1 mb-4" data-testid="cardapio">
            {ativa?.items.map((c) => {
              const qtd = naComanda.get(c.id) ?? 0;
              return (
                <div
                  key={c.id}
                  className={`relative rounded-xl border flex overflow-hidden ${
                    qtd > 0
                      ? 'border-pink-500/60 bg-pink-500/10'
                      : 'border-slate-700 bg-slate-800/60'
                  }`}
                >
                  <button
                    onClick={() => void lancar(c.id, undefined)}
                    aria-label={`Adicionar ${c.name}`}
                    className="flex-1 min-w-0 text-left px-3 py-3 min-h-16 active:bg-pink-500/20"
                  >
                    <span className="block text-slate-100 text-sm font-semibold leading-tight">
                      {c.name}
                    </span>
                    <span
                      className={`block text-xs mt-1 ${
                        c.priceCents === undefined ? 'text-amber-300' : 'text-slate-400'
                      }`}
                    >
                      {formatPrice(c.priceCents)}
                    </span>
                  </button>
                  {qtd > 0 ? (
                    <div className="flex flex-col items-center justify-between py-1 pr-1.5">
                      <span
                        className="text-pink-300 font-mono font-black text-sm leading-none pt-1"
                        data-testid={`qtd-${normalizeName(c.name)}`}
                      >
                        {qtd}×
                      </span>
                      <button
                        onClick={() => void tirarUm(c)}
                        aria-label={`Tirar um ${c.name}`}
                        className="w-9 h-7 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-700 flex items-center justify-center"
                      >
                        <Minus size={14} aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <span className="self-center pr-3 text-slate-600" aria-hidden>
                      <Plus size={16} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {(pairings.data ?? []).length > 0 && (
            <div className="mb-3" data-testid="costuma-sair-junto">
              <p className="text-xs text-slate-500 mb-1.5">Costuma sair junto</p>
              <div className="flex flex-wrap gap-2">
                {(pairings.data ?? []).map((p) => (
                  <button
                    key={p.catalogItemId}
                    onClick={() => void lancar(p.catalogItemId, undefined)}
                    title={`Saiu com ${p.because} em ${p.tabs} ${p.tabs === 1 ? 'comanda' : 'comandas'}`}
                    className="px-3 py-2 rounded-xl text-sm font-semibold bg-sky-500/10 hover:bg-sky-500/25 text-sky-200 border border-sky-500/40 text-left"
                  >
                    <span className="block">+ {p.name}</span>
                    <span className="block text-[10px] font-normal text-sky-300/70">
                      com {p.because}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block mb-2">
            <span className="block text-slate-400 text-sm mb-1.5">
              Não achou? Digite (ex.: <span className="font-mono">3 chopp</span> lança 3 de uma vez)
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
                onClick={() => void lancarDigitado(s.id, undefined)}
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
                onClick={() => void lancarDigitado(undefined, term)}
                className="px-3 py-2 rounded-xl text-sm border border-dashed border-slate-500 text-slate-300 hover:bg-slate-800"
              >
                Adicionar “{term.trim()}” como novo item
              </button>
            )}
          </div>
        </>
      )}

      <div className="border-t border-slate-800 pt-3 mt-3">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-slate-300">Consumo</h3>
          <span className="text-xs text-slate-500">
            {units} itens · parcial, sujeito a conferência no caixa
          </span>
        </div>
        {!d || d.lines.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum item lançado.</p>
        ) : (
          <ul className="mb-3 flex flex-wrap gap-2" data-testid="resumo-garcom">
            {d.lines.map((l) => (
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

        <div className="flex flex-wrap gap-2 mb-3">
          {status === 'aberta' && (
            <button
              onClick={() => void agir(() => backend.requestBillByStaff(tab.id))}
              className={ghostButton}
              data-testid="mesa-pediu-conta"
            >
              A mesa pediu a conta
            </button>
          )}
          {tab.phoneLast4 && aberta && (
            <button onClick={() => void recuperarAcesso()} className={ghostButton}>
              Recuperar acesso do cliente
            </button>
          )}
        </div>

        {acesso && (
          <div
            className="rounded-xl border border-slate-700 p-3 mb-3 text-center"
            data-testid="qr-acesso"
          >
            <p className="text-xs text-slate-400 mb-2">
              Peça ao cliente para ler este código com o celular. O acesso antigo deixa de valer.
            </p>
            <div className="inline-block bg-white p-3 rounded-xl">
              <QRCodeSVG value={acesso} size={180} level="M" />
            </div>
            <div>
              <button onClick={() => setAcesso(null)} className={`${ghostButton} mt-2`}>
                Fechar
              </button>
            </div>
          </div>
        )}

        {d && d.ledger.length > 0 && (
          <details>
            <summary className="text-xs text-slate-500 cursor-pointer">
              Lançamentos ({d.ledger.length})
            </summary>
            <ul className="mt-2 divide-y divide-slate-800 text-sm">
              {d.ledger.map((l) => {
                const zerada = l.qty > 0 && l.remaining === 0;
                return (
                  <li key={l.id} className="flex items-center gap-2 py-2">
                    <span className="text-slate-600 font-mono text-xs w-11">
                      {formatClock(Date.parse(l.createdAt))}
                    </span>
                    <span
                      className={`flex-1 ${
                        l.qty < 0 || zerada ? 'text-slate-600 line-through' : 'text-slate-300'
                      }`}
                    >
                      {l.qty > 0 ? '+' : ''}
                      {l.qty} {l.name}
                      {l.qty < 0 && ' (estorno)'}
                      {l.qty > 0 &&
                        l.remaining > 0 &&
                        l.remaining < l.qty &&
                        ` (restam ${l.remaining})`}
                    </span>
                    {l.remaining > 0 && aberta && (
                      <button
                        onClick={() => void agir(() => backend.reverseItem(l.id))}
                        className={ghostButton}
                      >
                        Estornar
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
      <span className="sr-only">{garcom.name}</span>
    </div>
  );
}

/** Contingência: abre a comanda só com nome e mesa, sem celular. */
function AbrirSemCelular({ onAberta }: { onAberta: (id: string) => void }) {
  const backend = useBackend();
  const [nome, setNome] = useState('');
  const [mesa, setMesa] = useState('');
  const [erro, setErro] = useState('');

  const abrir = async () => {
    try {
      const r = await backend.openTabByStaff(nome, mesa);
      setNome('');
      setMesa('');
      setErro('');
      onAberta(r.tabId);
    } catch (e) {
      setErro(errorMessage(e));
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
        <button onClick={() => void abrir()} className={primaryButton} style={primaryStyle}>
          Abrir
        </button>
      </div>
      {erro && <p className="text-red-400 text-sm mt-1">{erro}</p>}
    </details>
  );
}

function GarcomTela({ garcom }: { garcom: StaffSession }) {
  const backend = useBackend();
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<TabListItem | null>(null);

  const resultados = useQuery(() => backend.findTabs(busca), [busca], { every: POLL_MS });
  const menu = useQuery(() => backend.menu(), [], { every: 60000 });

  const abrirPorId = async (id: string) => {
    const lista = await backend.findTabs('');
    setSelecionada(lista.find((t) => t.id === id) ?? null);
  };

  return (
    <ComandaShell
      papel="garcom"
      titulo={`Garçom · ${garcom.name}`}
      direita={
        <button onClick={() => void garcom.signOut()} className={ghostButton}>
          Sair
        </button>
      }
    >
      {/* Com uma comanda aberta, a lista de busca recolhe: o cardápio é o foco. */}
      {selecionada ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-400">
            Lançando na comanda <strong className="text-pink-300">{selecionada.code}</strong>
          </p>
          <button onClick={() => setSelecionada(null)} className={ghostButton}>
            Trocar comanda
          </button>
        </div>
      ) : (
        <>
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
            {resultados.error ? (
              <p role="alert" className="text-red-400 text-sm">
                {errorMessage(resultados.error)}
              </p>
            ) : (resultados.data ?? []).length === 0 ? (
              <p className="text-slate-500 text-sm">
                {resultados.loading ? 'Carregando…' : 'Nenhuma comanda de hoje encontrada.'}
              </p>
            ) : (
              (resultados.data ?? []).map((t) => (
                <LinhaComanda key={t.id} tab={t} onClick={() => setSelecionada(t)} />
              ))
            )}
          </div>

          <AbrirSemCelular onAberta={(id) => void abrirPorId(id)} />
        </>
      )}

      {selecionada && (
        <PainelComanda
          key={selecionada.id}
          tab={selecionada}
          garcom={garcom}
          menu={menu.data ?? []}
        />
      )}
    </ComandaShell>
  );
}

export default function GarcomView() {
  return (
    <StaffGate papel="garcom" titulo="Garçom">
      {(garcom) => <GarcomTela garcom={garcom} />}
    </StaffGate>
  );
}
