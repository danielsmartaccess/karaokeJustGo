import { normalizePhone } from '../lib/whatsapp';
import type {
  CatalogItem,
  ComandaState,
  ItemSummaryLine,
  PhoneStatus,
  Tab,
  TabItem,
} from './types';

/**
 * Regras de negócio das comandas, em funções puras.
 *
 * Mesma ideia do reducer do karaokê: é aqui que a lógica vive e onde os testes
 * batem, sem montar componente nem tocar em rede. Cada operação devolve o novo
 * estado e um resultado; nada é alterado no lugar.
 */

/** A noite do bar vai até esta hora: 01h de sábado ainda é o dia de sexta. */
export const DAY_CUTOFF_HOUR = 6;

/** Teto de comandas por dia, contra lixo no banco (ver docs/COMANDAS.md, seção 8). */
export const MAX_TABS_PER_DAY = 500;

export interface Result<T> {
  state: ComandaState;
  result: T;
}

type Failure<R extends string> = { ok: false; reason: R };

function fail<R extends string>(state: ComandaState, reason: R): Result<Failure<R>> {
  return { state, result: { ok: false, reason } };
}

// --- Texto -------------------------------------------------------------------

/** Minúsculas, sem acento e com espaços normalizados: base de toda busca. */
export function normalizeName(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Digitação rápida do garçom: "3 chopp" lança 3 de uma vez.
 * Aceita "3 chopp", "3x chopp" e "3 x chopp". Só vale como quantidade até 20,
 * para "51 ice" não virar 51 unidades.
 */
export function parseQuickEntry(text: string): { qty: number; term: string } {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\d{1,2})\s*[x×]?\s+(.+)$/i);
  if (match) {
    const qty = Number(match[1]);
    if (qty >= 1 && qty <= 20) return { qty, term: match[2].trim() };
  }
  return { qty: 1, term: trimmed };
}

// --- Dia de serviço ----------------------------------------------------------

/** Dia de serviço (AAAA-MM-DD) de um instante, no horário local do aparelho. */
export function serviceDay(at: number | Date, cutoffHour = DAY_CUTOFF_HOUR): string {
  const d = new Date(typeof at === 'number' ? at : at.getTime());
  d.setHours(d.getHours() - cutoffHour);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// --- Catálogo ----------------------------------------------------------------

/** Item de destino de uma junção (segue a cadeia até o item final). */
export function resolveCatalogItem(catalog: CatalogItem[], id: string): CatalogItem | undefined {
  let current = catalog.find((c) => c.id === id);
  const seen = new Set<string>();
  while (current?.mergedInto && !seen.has(current.id)) {
    seen.add(current.id);
    current = catalog.find((c) => c.id === current!.mergedInto);
  }
  return current;
}

/**
 * Sugestões do autocomplete: tolerante a acento e abreviação ("chop" acha
 * "Chopp"). Ordena por quão no começo casa, depois por uso e recência. Sem
 * texto, devolve os mais usados.
 */
export function searchCatalog(catalog: CatalogItem[], term: string, limit = 8): CatalogItem[] {
  const tokens = normalizeName(term).split(' ').filter(Boolean);
  const live = catalog.filter((c) => c.status !== 'archived' && !c.mergedInto);

  const scored = live
    .filter((c) => tokens.every((t) => c.normalized.includes(t)))
    .map((c) => {
      const words = c.normalized.split(' ');
      let rank = 3;
      if (tokens.length > 0) {
        if (c.normalized.startsWith(tokens[0])) rank = 0;
        else if (words.some((w) => w.startsWith(tokens[0]))) rank = 1;
        else rank = 2;
      }
      return { c, rank };
    });

  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      b.c.useCount - a.c.useCount ||
      (b.c.lastUsedAt ?? 0) - (a.c.lastUsedAt ?? 0) ||
      a.c.name.localeCompare(b.c.name, 'pt-BR'),
  );
  return scored.slice(0, limit).map((s) => s.c);
}

// --- Abertura e confirmação --------------------------------------------------

export interface OpenTabInput {
  name: string;
  phone?: string;
  tableLabel?: string;
  openedBy: 'cliente' | 'garcom';
  /** Id do cliente; o chamador pode fornecer para testes determinísticos. */
  id?: string;
}

export type OpenTabFailure = 'invalid-name' | 'invalid-phone' | 'phone-already-open' | 'daily-cap';

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * Abre a comanda do dia.
 *
 * Nunca devolve uma comanda existente: se o celular já tem comanda hoje, recusa
 * (quem só digitou o número alheio não pode ver o consumo de outra pessoa). A
 * recuperação passa pelo garçom.
 */
export function openTab(
  state: ComandaState,
  input: OpenTabInput,
  now: number,
): Result<{ ok: true; tab: Tab } | Failure<OpenTabFailure>> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) return fail(state, 'invalid-name');

  let phone: string | undefined;
  if (input.phone && input.phone.trim() !== '') {
    const normalized = normalizePhone(input.phone);
    if (!normalized) return fail(state, 'invalid-phone');
    phone = normalized;
  } else if (input.openedBy === 'cliente') {
    return fail(state, 'invalid-phone'); // o cliente precisa informar o celular
  }

  const day = serviceDay(now);
  const today = state.tabs.filter((t) => t.serviceDay === day);
  if (today.length >= MAX_TABS_PER_DAY) return fail(state, 'daily-cap');
  if (phone && today.some((t) => t.phone === phone && !t.voidedAt)) {
    return fail(state, 'phone-already-open');
  }

  const status: PhoneStatus = phone ? 'informado' : 'sem_celular';
  const tab: Tab = {
    id: input.id ?? newId('tab'),
    code: today.reduce((max, t) => Math.max(max, t.code), 0) + 1,
    customerName: name,
    phone,
    phoneLast4: phone?.slice(-4),
    phoneStatus: status,
    tableLabel: input.tableLabel?.trim() || undefined,
    serviceDay: day,
    openedAt: now,
    openedBy: input.openedBy,
  };
  return { state: { ...state, tabs: [...state.tabs, tab] }, result: { ok: true, tab } };
}

/** O garçom confirma, na mesa, o celular que o cliente informou. */
export function confirmPhone(state: ComandaState, tabId: string): Result<{ ok: boolean }> {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab || !tab.phone || tab.phoneStatus === 'confirmado')
    return { state, result: { ok: false } };
  const tabs = state.tabs.map((t) =>
    t.id === tabId ? { ...t, phoneStatus: 'confirmado' as PhoneStatus } : t,
  );
  return { state: { ...state, tabs }, result: { ok: true } };
}

/** O gerente anula uma comanda lixo sem apagá-la. */
export function voidTab(state: ComandaState, tabId: string, now: number): Result<{ ok: boolean }> {
  if (!state.tabs.some((t) => t.id === tabId && !t.voidedAt))
    return { state, result: { ok: false } };
  const tabs = state.tabs.map((t) => (t.id === tabId ? { ...t, voidedAt: now } : t));
  return { state: { ...state, tabs }, result: { ok: true } };
}

// --- Busca do garçom ---------------------------------------------------------

/**
 * Busca de comandas de HOJE por código, 4 últimos dígitos ou nome. Sem
 * telefone completo, no máximo 10 resultados e nunca de outro dia.
 */
export function findTabs(state: ComandaState, query: string, day: string, limit = 10): Tab[] {
  const q = query.trim();
  const today = state.tabs.filter((t) => t.serviceDay === day && !t.voidedAt);
  if (q === '') return today.sort((a, b) => b.code - a.code).slice(0, limit);

  const digits = q.replace(/\D/g, '');
  const name = normalizeName(q);
  return today
    .filter(
      (t) =>
        (digits !== '' && String(t.code) === digits) ||
        (digits.length === 4 && t.phoneLast4 === digits) ||
        (name !== '' && normalizeName(t.customerName).includes(name)),
    )
    .sort((a, b) => b.code - a.code)
    .slice(0, limit);
}

// --- Itens -------------------------------------------------------------------

export type AddItemFailure = 'tab-not-found' | 'tab-not-open-today' | 'invalid-qty' | 'empty-name';

export interface AddItemInput {
  tabId: string;
  /** Item do catálogo; ausente = texto digitado, que vira sugestão. */
  catalogItemId?: string;
  name?: string;
  qty: number;
  by: string;
}

/**
 * Lança um item. Item digitado que não existe vira uma sugestão no catálogo,
 * já utilizável por todos os garçons; o gerente decide depois. Só aceita itens
 * em comanda de hoje: depois do corte da noite, a comanda se fecha sozinha.
 */
export function addItem(
  state: ComandaState,
  input: AddItemInput,
  now: number,
): Result<{ ok: true; item: TabItem; created: boolean } | Failure<AddItemFailure>> {
  const tab = state.tabs.find((t) => t.id === input.tabId);
  if (!tab) return fail(state, 'tab-not-found');
  if (tab.voidedAt || tab.serviceDay !== serviceDay(now)) return fail(state, 'tab-not-open-today');
  if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > 99)
    return fail(state, 'invalid-qty');

  let catalog = state.catalog;
  let target: CatalogItem | undefined = input.catalogItemId
    ? resolveCatalogItem(catalog, input.catalogItemId)
    : undefined;
  let created = false;

  if (!target) {
    const name = (input.name ?? '').trim().replace(/\s+/g, ' ');
    if (name === '') return fail(state, 'empty-name');
    const normalized = normalizeName(name);
    target = catalog.find(
      (c) => c.normalized === normalized && c.status !== 'archived' && !c.mergedInto,
    );
    if (!target) {
      target = {
        id: newId('cat'),
        name,
        normalized,
        category: 'Outros',
        status: 'suggested',
        useCount: 0,
      };
      catalog = [...catalog, target];
      created = true;
    }
  }

  const used = target;
  catalog = catalog.map((c) =>
    c.id === used.id ? { ...c, useCount: c.useCount + input.qty, lastUsedAt: now } : c,
  );

  const item: TabItem = {
    id: newId('item'),
    tabId: tab.id,
    catalogItemId: used.id,
    nameSnapshot: used.name,
    qty: input.qty,
    unitPriceCents: used.priceCents,
    addedBy: input.by,
    createdAt: now,
  };
  return {
    state: { ...state, catalog, items: [...state.items, item] },
    result: { ok: true, item, created },
  };
}

/** Unidades de uma linha que ainda não foram estornadas. */
export function remainingQty(state: ComandaState, item: TabItem): number {
  if (item.qty <= 0) return 0;
  const reversed = state.items
    .filter((i) => i.reversesItemId === item.id)
    .reduce((sum, i) => sum - i.qty, 0);
  return item.qty - reversed;
}

/**
 * Estorno: nova linha negativa apontando para a original. Pode ser parcial (o
 * "−" do garçom tira uma unidade de uma linha de três); sem `qty`, estorna tudo
 * o que resta. A linha original nunca é alterada.
 */
export function reverseItem(
  state: ComandaState,
  itemId: string,
  by: string,
  now: number,
  qty?: number,
): Result<{ ok: boolean }> {
  const original = state.items.find((i) => i.id === itemId);
  if (!original) return { state, result: { ok: false } };
  const left = remainingQty(state, original);
  const amount = qty ?? left;
  if (left <= 0 || !Number.isInteger(amount) || amount < 1 || amount > left) {
    return { state, result: { ok: false } };
  }

  const reversal: TabItem = {
    id: newId('item'),
    tabId: original.tabId,
    catalogItemId: original.catalogItemId,
    nameSnapshot: original.nameSnapshot,
    qty: -amount,
    unitPriceCents: original.unitPriceCents,
    reversesItemId: original.id,
    addedBy: by,
    createdAt: now,
  };
  return { state: { ...state, items: [...state.items, reversal] }, result: { ok: true } };
}

/** Tira UMA unidade do item na comanda, da linha mais recente que ainda tem saldo (o "−" do cardápio). */
export function removeOne(
  state: ComandaState,
  tabId: string,
  catalogItemId: string,
  by: string,
  now: number,
): Result<{ ok: boolean }> {
  const key = (id: string) => resolveCatalogItem(state.catalog, id)?.id ?? id;
  const line = state.items
    .filter(
      (i) =>
        i.tabId === tabId &&
        i.qty > 0 &&
        key(i.catalogItemId) === key(catalogItemId) &&
        remainingQty(state, i) > 0,
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!line) return { state, result: { ok: false } };
  return reverseItem(state, line.id, by, now, 1);
}

/** Consumo agrupado ("3× Chopp"), já descontados os estornos e as junções, com o total em reais. */
export function summarizeItems(state: ComandaState, tabId: string): ItemSummaryLine[] {
  const groups = new Map<string, { qty: number; totalCents: number; unpricedQty: number }>();
  for (const item of state.items.filter((i) => i.tabId === tabId)) {
    const resolved = resolveCatalogItem(state.catalog, item.catalogItemId);
    const key = resolved?.id ?? item.catalogItemId;
    const g = groups.get(key) ?? { qty: 0, totalCents: 0, unpricedQty: 0 };
    g.qty += item.qty;
    // O preço da hora protege vendas que já tinham preço. Venda feita SEM preço usa o
    // preço atual do catálogo, para que precificar depois feche a conta do dia.
    const unit = item.unitPriceCents ?? resolved?.priceCents;
    if (unit === undefined) g.unpricedQty += item.qty;
    else g.totalCents += item.qty * unit;
    groups.set(key, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.qty > 0)
    .map(([catalogItemId, g]) => ({
      catalogItemId,
      qty: g.qty,
      totalCents: g.totalCents,
      unpricedQty: g.unpricedQty,
      name:
        resolveCatalogItem(state.catalog, catalogItemId)?.name ??
        state.items.find((i) => i.catalogItemId === catalogItemId)?.nameSnapshot ??
        '?',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function totalUnits(lines: ItemSummaryLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

/** Total parcial da comanda. Unidades sem preço ficam de fora e são contadas à parte. */
export function tabTotals(
  state: ComandaState,
  tabId: string,
): { units: number; totalCents: number; unpricedUnits: number } {
  const lines = summarizeItems(state, tabId);
  return {
    units: totalUnits(lines),
    totalCents: lines.reduce((sum, l) => sum + l.totalCents, 0),
    unpricedUnits: lines.reduce((sum, l) => sum + l.unpricedQty, 0),
  };
}

// --- Venda sugestiva ----------------------------------------------------------

export interface Pairing {
  item: CatalogItem;
  /** Item da comanda atual que mais puxa esta sugestão ("costuma sair com Chopp"). */
  because: string;
  /** Em quantas outras comandas os dois apareceram juntos. */
  tabs: number;
}

/**
 * "Costuma sair junto": itens que, nas outras comandas, apareceram junto com o
 * que esta comanda já tem, e que esta ainda não tem. Contagem simples de
 * coocorrência por comanda, sem modelo: transparente e fácil de explicar ao bar.
 * (Protótipo: recalcula o consumo de cada comanda; o banco real agregaria.)
 */
export function suggestPairings(state: ComandaState, tabId: string, limit = 3): Pairing[] {
  const mine = summarizeItems(state, tabId).map((l) => l.catalogItemId);
  if (mine.length === 0) return [];
  const mineSet = new Set(mine);

  const score = new Map<string, { tabs: number; because: Map<string, number> }>();
  for (const tab of state.tabs) {
    if (tab.id === tabId || tab.voidedAt) continue;
    const ids = new Set(summarizeItems(state, tab.id).map((l) => l.catalogItemId));
    const shared = mine.filter((m) => ids.has(m));
    if (shared.length === 0) continue;
    for (const id of ids) {
      if (mineSet.has(id)) continue;
      const s = score.get(id) ?? { tabs: 0, because: new Map<string, number>() };
      s.tabs += 1;
      for (const m of shared) s.because.set(m, (s.because.get(m) ?? 0) + 1);
      score.set(id, s);
    }
  }

  const out: Pairing[] = [];
  for (const [id, s] of score) {
    const item = state.catalog.find((c) => c.id === id);
    if (!item || item.status === 'archived' || item.mergedInto) continue;
    const bestId = [...s.because.entries()].sort((a, b) => b[1] - a[1])[0][0];
    out.push({
      item,
      tabs: s.tabs,
      because: state.catalog.find((c) => c.id === bestId)?.name ?? '',
    });
  }
  return out.sort((a, b) => b.tabs - a.tabs || b.item.useCount - a.item.useCount).slice(0, limit);
}

// --- Cardápio rápido ------------------------------------------------------------

export interface MenuCategory {
  category: string;
  items: CatalogItem[];
}

/** Itens vivos agrupados por categoria; a categoria e os itens mais vendidos vêm primeiro. */
export function menuByCategory(catalog: CatalogItem[]): MenuCategory[] {
  const groups = new Map<string, CatalogItem[]>();
  for (const c of catalog.filter((x) => x.status !== 'archived' && !x.mergedInto)) {
    groups.set(c.category, [...(groups.get(c.category) ?? []), c]);
  }
  const use = (items: CatalogItem[]) => items.reduce((sum, c) => sum + c.useCount, 0);
  return [...groups.entries()]
    .map(([category, items]) => ({
      category,
      items: [...items].sort(
        (a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name, 'pt-BR'),
      ),
    }))
    .sort((a, b) => use(b.items) - use(a.items) || a.category.localeCompare(b.category, 'pt-BR'));
}

// --- Relatório de vendas (gerente) ---------------------------------------------

export interface SalesLine {
  catalogItemId: string;
  name: string;
  units: number;
  revenueCents: number;
}

export interface SalesReport {
  tabs: number;
  units: number;
  /** Faturamento parcial: só o que tem preço. */
  revenueCents: number;
  unpricedUnits: number;
  /** Ticket médio entre as comandas que têm valor. */
  avgTicketCents: number;
  unitsPerTab: number;
  top: SalesLine[];
  /** Itens vendidos sem preço: o gerente precisa precificar para o faturamento fechar. */
  unpricedItems: SalesLine[];
}

export function salesReport(state: ComandaState, day: string): SalesReport {
  const tabs = state.tabs.filter((t) => t.serviceDay === day && !t.voidedAt);
  const byItem = new Map<string, SalesLine & { unpriced: number }>();
  let revenueCents = 0;
  let units = 0;
  let unpricedUnits = 0;
  let tabsWithRevenue = 0;

  for (const tab of tabs) {
    let tabRevenue = 0;
    for (const line of summarizeItems(state, tab.id)) {
      const entry = byItem.get(line.catalogItemId) ?? {
        catalogItemId: line.catalogItemId,
        name: line.name,
        units: 0,
        revenueCents: 0,
        unpriced: 0,
      };
      entry.units += line.qty;
      entry.revenueCents += line.totalCents;
      entry.unpriced += line.unpricedQty;
      byItem.set(line.catalogItemId, entry);
      units += line.qty;
      unpricedUnits += line.unpricedQty;
      tabRevenue += line.totalCents;
    }
    revenueCents += tabRevenue;
    if (tabRevenue > 0) tabsWithRevenue += 1;
  }

  const all = [...byItem.values()];
  return {
    tabs: tabs.length,
    units,
    revenueCents,
    unpricedUnits,
    avgTicketCents: tabsWithRevenue > 0 ? Math.round(revenueCents / tabsWithRevenue) : 0,
    unitsPerTab: tabs.length > 0 ? units / tabs.length : 0,
    top: all
      .map((e) => ({
        catalogItemId: e.catalogItemId,
        name: e.name,
        units: e.units,
        revenueCents: e.revenueCents,
      }))
      .sort((a, b) => b.units - a.units || b.revenueCents - a.revenueCents)
      .slice(0, 8),
    unpricedItems: all
      .filter((e) => e.unpriced > 0)
      .map((e) => ({
        catalogItemId: e.catalogItemId,
        name: e.name,
        units: e.unpriced,
        revenueCents: 0,
      }))
      .sort((a, b) => b.units - a.units),
  };
}

// --- Curadoria do catálogo (gerente) -----------------------------------------

function mapCatalog(
  state: ComandaState,
  id: string,
  fn: (c: CatalogItem) => CatalogItem,
): ComandaState {
  return { ...state, catalog: state.catalog.map((c) => (c.id === id ? fn(c) : c)) };
}

export function approveCatalogItem(state: ComandaState, id: string): ComandaState {
  return mapCatalog(state, id, (c) => ({ ...c, status: 'approved' }));
}

export function renameCatalogItem(state: ComandaState, id: string, name: string): ComandaState {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean === '') return state;
  return mapCatalog(state, id, (c) => ({ ...c, name: clean, normalized: normalizeName(clean) }));
}

export function archiveCatalogItem(state: ComandaState, id: string): ComandaState {
  return mapCatalog(state, id, (c) => ({ ...c, status: 'archived' }));
}

/** Junta uma duplicata a outro item: os totais passam a somar no destino. */
export function mergeCatalogItem(
  state: ComandaState,
  fromId: string,
  intoId: string,
): ComandaState {
  if (fromId === intoId) return state;
  const source = state.catalog.find((c) => c.id === fromId);
  const target = resolveCatalogItem(state.catalog, intoId);
  if (!source || !target || target.id === fromId) return state;

  return {
    ...state,
    catalog: state.catalog.map((c) => {
      if (c.id === fromId) return { ...c, mergedInto: target.id, status: 'archived' as const };
      if (c.id === target.id) return { ...c, useCount: c.useCount + source.useCount };
      return c;
    }),
  };
}

export function addCatalogItem(
  state: ComandaState,
  name: string,
  category: string,
  priceCents?: number,
): ComandaState {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean === '') return state;
  const normalized = normalizeName(clean);
  if (state.catalog.some((c) => c.normalized === normalized && c.status !== 'archived'))
    return state;
  const item: CatalogItem = {
    id: newId('cat'),
    name: clean,
    normalized,
    category: category.trim() || 'Outros',
    priceCents,
    status: 'approved',
    useCount: 0,
  };
  return { ...state, catalog: [...state.catalog, item] };
}

/** Define (ou limpa, com `undefined`) o preço de um item. Vendas já lançadas mantêm o preço da hora. */
export function setCatalogPrice(
  state: ComandaState,
  id: string,
  priceCents: number | undefined,
): ComandaState {
  if (priceCents !== undefined && (!Number.isInteger(priceCents) || priceCents < 0)) return state;
  return mapCatalog(state, id, (c) => ({ ...c, priceCents }));
}

/**
 * Converte o que o gerente digita em centavos: "12,50", "12.5", "R$ 8", "1.250,00".
 * Vazio devolve `undefined` (limpa o preço); texto inválido também.
 */
export function parsePriceCents(text: string): number | undefined {
  const s = text.replace(/R\$/gi, '').replace(/\s/g, '');
  if (s === '') return undefined;
  let n: number;
  if (s.includes(',')) n = Number(s.replace(/\./g, '').replace(',', '.'));
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) n = Number(s.replace(/\./g, ''));
  else n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return undefined;
  return Math.round(n * 100);
}

// --- Equipe -------------------------------------------------------------------

export function setStaffActive(state: ComandaState, id: string, active: boolean): ComandaState {
  return { ...state, staff: state.staff.map((s) => (s.id === id ? { ...s, active } : s)) };
}
