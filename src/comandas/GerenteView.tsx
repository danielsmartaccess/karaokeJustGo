import { useState } from 'react';
import { useBackend, useQuery } from './backend/hooks';
import { errorMessage } from './backend/messages';
import { ComandaError, type CatalogEntry, type ManagerTab } from './backend/types';
import { ComandaShell, StatusChip } from './ComandaShell';
import { formatBRL, formatClock, formatPhone } from './format';
import { normalizeName, parsePriceCents, serviceDay } from './rules';
import { StaffGate, type StaffSession } from './StaffGate';
import type { PaymentMethod } from './types';
import { cardClass, ghostButton, inputClass, primaryButton, primaryStyle } from './ui';

type Aba = 'caixa' | 'vendas' | 'consumo' | 'catalogo' | 'equipe';

const POLL_MS = 6000;

const PAGAMENTOS: { id: PaymentMethod; label: string }[] = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'cartao', label: 'Cartão (maquininha)' },
  { id: 'pix', label: 'Pix' },
  { id: 'outro', label: 'Outro' },
];

const STATUS_TEXTO: Record<ManagerTab['status'], string> = {
  aberta: 'Aberta',
  conta_pedida: 'Conta pedida',
  fechada: 'Fechada',
  anulada: 'Anulada',
};

/** Roda uma ação do gerente, guarda o erro em português e avisa quando deu certo. */
function useAcao(depois: () => void | Promise<void>) {
  const [erro, setErro] = useState('');
  const agir = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setErro('');
    try {
      const r = await fn();
      await depois();
      return r;
    } catch (e) {
      setErro(errorMessage(e));
      return undefined;
    }
  };
  return { erro, agir, setErro };
}

function Erro({ texto }: { texto: string }) {
  return texto ? (
    <p role="alert" className="text-red-400 text-sm mt-2">
      {texto}
    </p>
  ) : null;
}

// --- Fechamento ----------------------------------------------------------------------------

/** Fecha a conta: congela o total e registra como foi paga. Não cobra: o app ainda não cobra. */
function FecharConta({ tab, onDone }: { tab: ManagerTab; onDone: () => void | Promise<void> }) {
  const backend = useBackend();
  const [metodo, setMetodo] = useState<PaymentMethod | ''>('');
  const [semPreco, setSemPreco] = useState(false);
  const { erro, agir, setErro } = useAcao(onDone);

  const fechar = async () => {
    if (!metodo) {
      setErro(errorMessage(new ComandaError('invalid-payment-method')));
      return;
    }
    await agir(() => backend.closeTab(tab.id, metodo, semPreco));
  };

  return (
    <div className="mt-3 border-t border-slate-800 pt-3" data-testid={`fechar-${tab.code}`}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${inputClass} w-auto py-2`}
          value={metodo}
          onChange={(e) => setMetodo(e.target.value as PaymentMethod | '')}
          aria-label={`Forma de pagamento da comanda ${tab.code}`}
        >
          <option value="">Como foi pago?</option>
          {PAGAMENTOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => void fechar()}
          className={primaryButton}
          style={primaryStyle}
          aria-label={`Fechar a conta da comanda ${tab.code}`}
        >
          Fechar conta · {formatBRL(tab.totalCents)}
        </button>
      </div>
      {tab.unpricedUnits > 0 && (
        <label className="flex items-start gap-2 mt-2 text-xs text-amber-300">
          <input
            type="checkbox"
            checked={semPreco}
            onChange={(e) => setSemPreco(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {tab.unpricedUnits} item(ns) sem preço ficam fora do total. Fechar mesmo assim.
          </span>
        </label>
      )}
      <Erro texto={erro} />
    </div>
  );
}

function CartaoComanda({
  tab,
  onChange,
}: {
  tab: ManagerTab;
  onChange: () => void | Promise<void>;
}) {
  const backend = useBackend();
  const [confirmar, setConfirmar] = useState(false);
  const [fechando, setFechando] = useState(false);
  const { erro, agir } = useAcao(onChange);
  const aberta = tab.status === 'aberta' || tab.status === 'conta_pedida';
  const total =
    tab.status === 'fechada' ? (tab.closedTotalCents ?? tab.totalCents) : tab.totalCents;

  return (
    <article
      className={`${cardClass} ${tab.status === 'anulada' ? 'opacity-50' : ''}`}
      data-testid={`comanda-${tab.code}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-white font-bold truncate">
            <span className="text-pink-400 font-display">#{tab.code}</span> {tab.customerName}
            {tab.status !== 'aberta' && (
              <span
                className={`text-xs ml-2 ${
                  tab.status === 'anulada'
                    ? 'text-red-400'
                    : tab.status === 'fechada'
                      ? 'text-green-400'
                      : 'text-sky-300'
                }`}
              >
                ({STATUS_TEXTO[tab.status].toLowerCase()})
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500">
            {tab.phone ? formatPhone(tab.phone) : 'sem celular'}
            {tab.tableLabel ? ` · mesa ${tab.tableLabel}` : ''} · aberta às{' '}
            {formatClock(Date.parse(tab.openedAt))}
            {tab.paymentMethod && ` · pago em ${tab.paymentMethod}`}
          </p>
        </div>
        <StatusChip status={tab.phoneStatus} />
      </div>

      {tab.lines.length === 0 ? (
        <p className="text-slate-500 text-sm mt-3">Nenhum item.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tab.lines.map((l) => (
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

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <span className="text-xs text-slate-500">
          {tab.units} itens
          {tab.unpricedUnits > 0 && (
            <span className="text-amber-300"> · {tab.unpricedUnits} sem preço</span>
          )}
          <strong className="ml-2 text-base text-white" data-testid={`total-${tab.code}`}>
            {formatBRL(total)}
          </strong>
        </span>
        <span className="flex gap-2">
          {aberta && !fechando && (
            <button
              onClick={() => setFechando(true)}
              className={`${ghostButton} border-green-500/50 text-green-300`}
            >
              Fechar conta
            </button>
          )}
          {tab.status === 'fechada' && (
            <button
              onClick={() => void agir(() => backend.reopenTab(tab.id))}
              className={ghostButton}
            >
              Reabrir
            </button>
          )}
          {aberta &&
            (confirmar ? (
              <>
                <button
                  onClick={() => void agir(() => backend.voidTab(tab.id))}
                  className={`${ghostButton} border-red-500/50 text-red-300`}
                >
                  Confirmar anulação
                </button>
                <button onClick={() => setConfirmar(false)} className={ghostButton}>
                  Cancelar
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmar(true)} className={ghostButton}>
                Anular comanda
              </button>
            ))}
        </span>
      </div>
      {aberta && fechando && <FecharConta tab={tab} onDone={onChange} />}
      <Erro texto={erro} />
    </article>
  );
}

// --- Caixa: contas pedidas -----------------------------------------------------------------

function Caixa() {
  const backend = useBackend();
  const fila = useQuery(() => backend.pendingBills(), [], { every: POLL_MS });
  const contas = fila.data ?? [];

  return (
    <div>
      <p className="text-sm text-slate-400 mb-3" data-testid="resumo-caixa">
        {contas.length === 0
          ? 'Nenhuma conta pedida agora. Quando um cliente (ou o garçom) pedir a conta, ela aparece aqui.'
          : `${contas.length} ${contas.length === 1 ? 'conta pedida' : 'contas pedidas'}, da mais antiga para a mais nova.`}
      </p>
      <div className="space-y-3" data-testid="fila-caixa">
        {contas.map((t) => (
          <div key={t.id}>
            <CartaoComanda tab={t} onChange={fila.reload} />
            <p className="text-xs text-slate-600 mt-1 ml-1">
              Pedida às {t.billRequestedAt ? formatClock(Date.parse(t.billRequestedAt)) : '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Comandas do dia ---------------------------------------------------------------------------

function Consumo() {
  const backend = useBackend();
  const hoje = serviceDay(Date.now());
  const [dia, setDia] = useState(hoje);
  const [busca, setBusca] = useState('');
  const lista = useQuery(() => backend.listTabs(dia), [dia], { every: POLL_MS });

  const q = normalizeName(busca);
  const digitos = busca.replace(/\D/g, '');
  const tabs = (lista.data ?? []).filter(
    (t) =>
      q === '' ||
      normalizeName(t.customerName).includes(q) ||
      (digitos !== '' && (String(t.code) === digitos || t.phone?.includes(digitos))),
  );
  const validas = tabs.filter((t) => t.status !== 'anulada');
  const faturamento = validas.reduce(
    (sum, t) =>
      sum + (t.status === 'fechada' ? (t.closedTotalCents ?? t.totalCents) : t.totalCents),
    0,
  );
  const unidades = validas.reduce((sum, t) => sum + t.units, 0);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="date"
          className={`${inputClass} w-auto`}
          value={dia}
          max={hoje}
          onChange={(e) => e.target.value && setDia(e.target.value)}
          aria-label="Dia de serviço"
        />
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
        {lista.error ? (
          <Erro texto={errorMessage(lista.error)} />
        ) : tabs.length === 0 ? (
          <p className="text-slate-500 text-sm">
            {lista.loading ? 'Carregando…' : 'Nenhuma comanda neste dia.'}
          </p>
        ) : (
          tabs.map((t) => <CartaoComanda key={t.id} tab={t} onChange={lista.reload} />)
        )}
      </div>
    </div>
  );
}

// --- Vendas ----------------------------------------------------------------------------------

function Vendas() {
  const backend = useBackend();
  const hoje = serviceDay(Date.now());
  const [dia, setDia] = useState(hoje);
  const rel = useQuery(() => backend.salesReport(dia), [dia], { every: POLL_MS * 2 });
  const r = rel.data;
  const maxUnidades = r?.top[0]?.units ?? 1;

  return (
    <div className="space-y-4" data-testid="vendas">
      <input
        type="date"
        className={`${inputClass} w-auto`}
        value={dia}
        max={hoje}
        onChange={(e) => e.target.value && setDia(e.target.value)}
        aria-label="Dia das vendas"
      />

      {rel.error ? <Erro texto={errorMessage(rel.error)} /> : null}

      {r && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Faturamento (parcial)', formatBRL(r.revenueCents), 'faturamento'],
              ['Ticket médio', formatBRL(r.avgTicketCents), 'ticket-medio'],
              ['Comandas', String(r.tabs), 'comandas'],
              [
                'Itens por comanda',
                r.unitsPerTab.toFixed(1).replace('.', ','),
                'itens-por-comanda',
              ],
            ].map(([rotulo, valor, id]) => (
              <div key={id} className={cardClass}>
                <p className="text-xs text-slate-500">{rotulo}</p>
                <p
                  className="text-2xl font-display font-black text-white"
                  data-testid={`kpi-${id}`}
                >
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
              {r.unpricedItems.map((i) => `${i.units}× ${i.name}`).join(', ')}). Defina o preço na
              aba Catálogo para o faturamento fechar.
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
            Contas fechadas entram pelo total congelado no fechamento.
          </p>
        </>
      )}
    </div>
  );
}

// --- Catálogo ----------------------------------------------------------------------------------

function NomeEditavel({
  item,
  onDone,
}: {
  item: CatalogEntry;
  onDone: () => void | Promise<void>;
}) {
  const backend = useBackend();
  const [nome, setNome] = useState(item.name);
  const { erro, agir } = useAcao(onDone);
  const salvar = async () => {
    if (nome.trim() === '' || nome.trim() === item.name) {
      setNome(item.name);
      return;
    }
    const ok = await agir(() => backend.renameItem(item.id, nome));
    if (ok === undefined) setNome(item.name);
  };
  return (
    <>
      <input
        className={`${inputClass} py-2`}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => void salvar()}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label={`Nome do item ${item.name}`}
      />
      <Erro texto={erro} />
    </>
  );
}

/** Preço em reais digitado como o gerente fala ("12,50"); vazio tira o preço. */
function PrecoEditavel({
  item,
  onDone,
}: {
  item: CatalogEntry;
  onDone: () => void | Promise<void>;
}) {
  const backend = useBackend();
  const mostrar = (c?: number) => (c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const [texto, setTexto] = useState(mostrar(item.priceCents));
  const { agir } = useAcao(onDone);
  const salvar = async () => {
    const cents = parsePriceCents(texto);
    if (texto.trim() !== '' && cents === undefined) {
      setTexto(mostrar(item.priceCents)); // inválido: volta ao valor salvo
      return;
    }
    if (cents !== item.priceCents) await agir(() => backend.setPrice(item.id, cents ?? null));
    setTexto(mostrar(cents));
  };
  return (
    <label className="flex items-center gap-1 text-xs text-slate-500">
      R$
      <input
        className={`${inputClass} py-2 w-20 text-right`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => void salvar()}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        placeholder="—"
        inputMode="decimal"
        aria-label={`Preço de ${item.name}`}
      />
    </label>
  );
}

function Catalogo() {
  const backend = useBackend();
  const lista = useQuery(() => backend.catalogList(), [], { every: POLL_MS * 2 });
  const { erro, agir } = useAcao(() => lista.reload());
  const [novo, setNovo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [preco, setPreco] = useState('');

  const vivos = (lista.data ?? []).filter((c) => !c.mergedInto);
  const sugeridos = vivos.filter((c) => c.status === 'suggested');
  const aprovados = vivos.filter((c) => c.status === 'approved');
  const arquivados = vivos.filter((c) => c.status === 'archived');

  return (
    <div className="space-y-5">
      <Erro texto={erro || (lista.error ? errorMessage(lista.error) : '')} />

      <section className={cardClass}>
        <h2 className="text-sm font-semibold text-amber-300 mb-1">
          Sugeridos pelos garçons ({sugeridos.length})
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Itens digitados na hora. Já aparecem para todos os garçons; defina o preço, aprove,
          renomeie ou junte com um item existente para não duplicar.
        </p>
        {sugeridos.length === 0 ? (
          <p className="text-slate-500 text-sm">Nada para curar.</p>
        ) : (
          <div className="space-y-3" data-testid="sugeridos">
            {sugeridos.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-800 p-3">
                <NomeEditavel item={c} onDone={lista.reload} />
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <PrecoEditavel item={c} onDone={lista.reload} />
                  <button
                    onClick={() => void agir(() => backend.approveItem(c.id))}
                    className={`${ghostButton} border-green-500/50 text-green-300`}
                  >
                    Aprovar
                  </button>
                  <select
                    className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300"
                    value=""
                    onChange={(e) =>
                      e.target.value && void agir(() => backend.mergeItem(c.id, e.target.value))
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
                    onClick={() => void agir(() => backend.archiveItem(c.id))}
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
                <NomeEditavel item={c} onDone={lista.reload} />
              </span>
              <PrecoEditavel item={c} onDone={lista.reload} />
              <span className="text-xs text-slate-600 w-14 text-right">{c.useCount} usos</span>
              <button
                onClick={() => void agir(() => backend.archiveItem(c.id))}
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
            onClick={async () => {
              const ok = await agir(() =>
                backend.addCatalogItem(novo, categoria || undefined, parsePriceCents(preco)),
              );
              if (ok) {
                setNovo('');
                setCategoria('');
                setPreco('');
              }
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

// --- Equipe -------------------------------------------------------------------------------------

function Equipe({ eu }: { eu: StaffSession }) {
  const backend = useBackend();
  const equipe = useQuery(() => backend.staffList(), [], { every: POLL_MS * 2 });
  const { erro, agir } = useAcao(() => equipe.reload());

  return (
    <section className={cardClass}>
      <p className="text-xs text-slate-500 mb-3">
        Quem cria a conta fica pendente até você ativar. Quem não está ativo não vê nenhuma comanda.
      </p>
      <Erro texto={erro || (equipe.error ? errorMessage(equipe.error) : '')} />
      <ul className="divide-y divide-slate-800">
        {(equipe.data ?? []).map((s) => {
          const euMesmo = s.name === eu.name && s.role === eu.role;
          return (
            <li key={s.userId} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex-1 min-w-0">
                <span className="block text-slate-100 font-semibold">{s.name}</span>
                <span className="block text-xs text-slate-500">
                  {s.role === 'gerente' ? 'Gerente' : 'Garçom'}
                  {s.email ? ` · ${s.email}` : ''}
                </span>
              </span>
              <span className={`text-xs ${s.active ? 'text-green-400' : 'text-amber-300'}`}>
                {s.active ? 'Ativo' : 'Pendente'}
              </span>
              <button
                onClick={() => void agir(() => backend.setStaffActive(s.userId, !s.active))}
                className={ghostButton}
              >
                {s.active ? 'Desativar' : 'Ativar'}
              </button>
              {!euMesmo && (
                <button
                  onClick={() =>
                    void agir(() =>
                      backend.setStaffRole(s.userId, s.role === 'gerente' ? 'garcom' : 'gerente'),
                    )
                  }
                  className={ghostButton}
                >
                  {s.role === 'gerente' ? 'Tornar garçom' : 'Tornar gerente'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- Tela ------------------------------------------------------------------------------------------

function GerenteTela({ eu }: { eu: StaffSession }) {
  const backend = useBackend();
  const [aba, setAba] = useState<Aba>('caixa');
  const fila = useQuery(() => backend.pendingBills(), [], { every: POLL_MS });
  const equipe = useQuery(() => backend.staffList(), [], { every: POLL_MS * 2 });

  const pedidas = (fila.data ?? []).length;
  const pendentes = (equipe.data ?? []).filter((s) => !s.active).length;

  const abas: { id: Aba; label: string; badge?: number }[] = [
    { id: 'caixa', label: 'Caixa', badge: pedidas },
    { id: 'vendas', label: 'Vendas' },
    { id: 'consumo', label: 'Comandas' },
    { id: 'catalogo', label: 'Catálogo' },
    { id: 'equipe', label: 'Equipe', badge: pendentes },
  ];

  return (
    <ComandaShell
      papel="gerente"
      titulo={`Gerente · ${eu.name}`}
      direita={
        <button onClick={() => void eu.signOut()} className={ghostButton}>
          Sair
        </button>
      }
    >
      <div
        className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4 overflow-x-auto"
        role="tablist"
      >
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`flex-1 shrink-0 px-3 py-2.5 rounded-lg text-sm font-semibold ${
              aba === a.id
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                : 'text-slate-500'
            }`}
          >
            {a.label}
            {(a.badge ?? 0) > 0 && (
              <span className="ml-1.5 text-[10px] bg-amber-400 text-black rounded-full px-1.5">
                {a.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {aba === 'caixa' && <Caixa />}
      {aba === 'vendas' && <Vendas />}
      {aba === 'consumo' && <Consumo />}
      {aba === 'catalogo' && <Catalogo />}
      {aba === 'equipe' && <Equipe eu={eu} />}
    </ComandaShell>
  );
}

export default function GerenteView() {
  return (
    <StaffGate papel="gerente" titulo="Gerente">
      {(eu) => <GerenteTela eu={eu} />}
    </StaffGate>
  );
}
