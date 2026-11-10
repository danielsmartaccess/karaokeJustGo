import type { PaymentMethod, PhoneStatus } from '../types';
import {
  ComandaError,
  type AddedItem,
  type CatalogEntry,
  type ClosedBill,
  type ComandaBackend,
  type ComandaErrorCode,
  type Consumption,
  type LedgerLine,
  type ManagerTab,
  type MenuItem,
  type MyTab,
  type Pairing,
  type SalesLine,
  type SalesReport,
  type StaffEntry,
  type StaffRole,
  type SummaryLine,
  type TabDetail,
  type TabListItem,
  type TabStatus,
  type Whoami,
} from './types';

/**
 * Fonte ao vivo: cada método chama uma função do banco (supabase/migrations/
 * *_comandas_*) e converte o jsonb (snake_case) para os tipos do contrato.
 *
 * `rpc` é injetado: em produção vem do cliente Supabase; nos testes, de um
 * dublê. O banco já valida e autoriza tudo; aqui só se traduz forma e erro.
 */

export interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}
export type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

type Raw = Record<string, unknown>;

// --- Leitura segura do jsonb ----------------------------------------------------------

const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const asRaw = (v: unknown): Raw => (isRaw(v) ? v : {});
const asArray = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter(isRaw) : []);
const str = (r: Raw, k: string): string => (typeof r[k] === 'string' ? (r[k] as string) : '');
const optStr = (r: Raw, k: string): string | undefined =>
  typeof r[k] === 'string' && r[k] !== '' ? (r[k] as string) : undefined;
const num = (r: Raw, k: string): number => (typeof r[k] === 'number' ? (r[k] as number) : 0);
const optNum = (r: Raw, k: string): number | undefined =>
  typeof r[k] === 'number' ? (r[k] as number) : undefined;
const bool = (r: Raw, k: string): boolean => r[k] === true;

// --- Erros -----------------------------------------------------------------------------

const KNOWN: ReadonlySet<string> = new Set<ComandaErrorCode>([
  'invalid-name',
  'invalid-phone',
  'phone-already-open',
  'daily-cap',
  'not-found',
  'tab-not-found',
  'tab-not-open-today',
  'tab-closed',
  'invalid-qty',
  'empty-name',
  'unpriced-items',
  'invalid-payment-method',
  'cannot-reopen',
  'cannot-deactivate-self',
  'cannot-change-own-role',
  'name-taken',
  'invalid-price',
  'forbidden',
]);

/** Traduz a mensagem do banco/PostgREST num código do contrato. */
export function toComandaError(message: string): ComandaError {
  const msg = message.trim();
  if (KNOWN.has(msg)) return new ComandaError(msg as ComandaErrorCode);
  if (/permission denied|not authorized|jwt|row-level security/i.test(msg)) {
    return new ComandaError('forbidden', msg);
  }
  if (/failed to fetch|network|load failed|timeout/i.test(msg)) {
    return new ComandaError('network', msg);
  }
  return new ComandaError('unknown', msg);
}

// --- Conversões ---------------------------------------------------------------------------

function consumption(r: Raw): Consumption {
  return {
    lines: asArray(r.lines).map((l): SummaryLine => ({
      catalogItemId: str(l, 'catalog_item_id'),
      name: str(l, 'name'),
      qty: num(l, 'qty'),
      totalCents: num(l, 'total_cents'),
      unpricedQty: num(l, 'unpriced_qty'),
    })),
    units: num(r, 'units'),
    totalCents: num(r, 'total_cents'),
    unpricedUnits: num(r, 'unpriced_units'),
  };
}

const phoneStatus = (r: Raw): PhoneStatus => str(r, 'phone_status') as PhoneStatus;
const tabStatus = (r: Raw): TabStatus => str(r, 'status') as TabStatus;
const payment = (r: Raw): PaymentMethod | undefined =>
  optStr(r, 'payment_method') as PaymentMethod | undefined;

export function toMyTab(raw: unknown): MyTab {
  const r = asRaw(raw);
  const t = asRaw(r.tab);
  return {
    ...consumption(r),
    id: str(t, 'id'),
    code: num(t, 'code'),
    customerName: str(t, 'customer_name'),
    tableLabel: optStr(t, 'table_label'),
    phoneStatus: phoneStatus(t),
    status: tabStatus(t),
    serviceDay: str(t, 'service_day'),
    billRequestedAt: optStr(t, 'bill_requested_at'),
    closedAt: optStr(t, 'closed_at'),
    closedTotalCents: optNum(t, 'closed_total_cents'),
  };
}

export function toTabDetail(raw: unknown): TabDetail {
  const r = asRaw(raw);
  const t = asRaw(r.tab);
  return {
    ...consumption(r),
    id: str(t, 'id'),
    code: num(t, 'code'),
    customerName: str(t, 'customer_name'),
    phone: optStr(t, 'phone'),
    phoneLast4: optStr(t, 'phone_last4'),
    phoneStatus: phoneStatus(t),
    tableLabel: optStr(t, 'table_label'),
    status: tabStatus(t),
    serviceDay: str(t, 'service_day'),
    openedAt: str(t, 'opened_at'),
    billRequestedAt: optStr(t, 'bill_requested_at'),
    closedAt: optStr(t, 'closed_at'),
    closedTotalCents: optNum(t, 'closed_total_cents'),
    paymentMethod: payment(t),
    ledger: asArray(r.ledger).map((l): LedgerLine => ({
      id: str(l, 'id'),
      name: str(l, 'name'),
      qty: num(l, 'qty'),
      unitPriceCents: optNum(l, 'unit_price_cents'),
      reversesItemId: optStr(l, 'reverses_item_id'),
      remaining: num(l, 'remaining'),
      createdAt: str(l, 'created_at'),
      addedBy: str(l, 'added_by'),
    })),
  };
}

export function toTabListItem(r: Raw): TabListItem {
  return {
    id: str(r, 'id'),
    code: num(r, 'code'),
    customerName: str(r, 'customer_name'),
    phoneLast4: optStr(r, 'phone_last4'),
    phoneStatus: phoneStatus(r),
    tableLabel: optStr(r, 'table_label'),
    status: tabStatus(r),
  };
}

export function toManagerTab(r: Raw): ManagerTab {
  return {
    ...consumption(r),
    id: str(r, 'id'),
    code: num(r, 'code'),
    customerName: str(r, 'customer_name'),
    phone: optStr(r, 'phone'),
    phoneStatus: phoneStatus(r),
    tableLabel: optStr(r, 'table_label'),
    status: tabStatus(r),
    openedAt: str(r, 'opened_at'),
    billRequestedAt: optStr(r, 'bill_requested_at'),
    closedAt: optStr(r, 'closed_at'),
    closedTotalCents: optNum(r, 'closed_total_cents'),
    paymentMethod: payment(r),
  };
}

export function toMenuItem(r: Raw): MenuItem {
  return {
    id: str(r, 'id'),
    name: str(r, 'name'),
    category: str(r, 'category'),
    priceCents: optNum(r, 'price_cents'),
    status: str(r, 'status') as MenuItem['status'],
    useCount: num(r, 'use_count'),
  };
}

const toSalesLine = (r: Raw): SalesLine => ({
  catalogItemId: str(r, 'catalog_item_id'),
  name: str(r, 'name'),
  units: num(r, 'units'),
  revenueCents: num(r, 'revenue_cents'),
});

export function toSalesReport(raw: unknown): SalesReport {
  const r = asRaw(raw);
  return {
    tabs: num(r, 'tabs'),
    units: num(r, 'units'),
    revenueCents: num(r, 'revenue_cents'),
    unpricedUnits: num(r, 'unpriced_units'),
    avgTicketCents: num(r, 'avg_ticket_cents'),
    unitsPerTab: num(r, 'units_per_tab'),
    top: asArray(r.top).map(toSalesLine),
    unpricedItems: asArray(r.unpriced_items).map(toSalesLine),
  };
}

const toWhoami = (raw: unknown): Whoami => {
  const r = asRaw(raw);
  return {
    registered: bool(r, 'registered'),
    name: optStr(r, 'name'),
    role: optStr(r, 'role') as StaffRole | undefined,
    active: r.active === undefined ? undefined : bool(r, 'active'),
  };
};

// --- O backend -------------------------------------------------------------------------------

export function createSupabaseBackend(rpc: Rpc): ComandaBackend {
  /** Chama a função e devolve o `data`; erro do banco vira ComandaError. */
  async function call(fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
    let res: RpcResult;
    try {
      res = await rpc(`comanda_${fn}`, args);
    } catch (e) {
      throw toComandaError(e instanceof Error ? e.message : String(e));
    }
    if (res.error) throw toComandaError(res.error.message);
    return res.data;
  }
  const ok = async (fn: string, args: Record<string, unknown>) =>
    bool(asRaw(await call(fn, args)), 'ok');

  return {
    mode: 'live',

    async openTab({ name, phone, table }) {
      const r = asRaw(
        await call('open_tab', { p_name: name, p_phone: phone, p_table: table ?? null }),
      );
      return { tabId: str(r, 'tab_id'), code: num(r, 'code'), secret: str(r, 'secret') };
    },
    async getMyTab(tabId, secret) {
      return toMyTab(await call('get_my_tab', { p_tab_id: tabId, p_secret: secret }));
    },
    async requestBill(tabId, secret) {
      await call('request_bill', { p_tab_id: tabId, p_secret: secret });
    },

    async whoami() {
      return toWhoami(await call('whoami'));
    },
    async registerStaff(name) {
      return toWhoami(await call('register_staff', { p_name: name }));
    },
    async menu() {
      return asArray(await call('menu')).map(toMenuItem);
    },
    async findTabs(query) {
      return asArray(await call('find_tabs', { p_query: query })).map(toTabListItem);
    },
    async getTab(tabId) {
      return toTabDetail(await call('get_tab', { p_tab_id: tabId }));
    },
    async openTabByStaff(name, table) {
      const r = asRaw(await call('open_tab_by_staff', { p_name: name, p_table: table ?? null }));
      return { tabId: str(r, 'tab_id'), code: num(r, 'code') };
    },
    confirmPhone: (tabId) => ok('confirm_phone', { p_tab_id: tabId }),
    async addItem({ tabId, catalogItemId, name, qty }): Promise<AddedItem> {
      const r = asRaw(
        await call('add_item', {
          p_tab_id: tabId,
          p_catalog_item_id: catalogItemId ?? null,
          p_name: name ?? null,
          p_qty: qty,
        }),
      );
      return { itemId: str(r, 'item_id'), name: str(r, 'name'), created: bool(r, 'created') };
    },
    reverseItem: (itemId, qty) => ok('reverse_item', { p_item_id: itemId, p_qty: qty ?? null }),
    removeOne: (tabId, catalogItemId) =>
      ok('remove_one', { p_tab_id: tabId, p_catalog_item_id: catalogItemId }),
    async suggestPairings(tabId, limit = 3): Promise<Pairing[]> {
      return asArray(await call('suggest_pairings', { p_tab_id: tabId, p_limit: limit })).map(
        (p) => ({
          catalogItemId: str(p, 'catalog_item_id'),
          name: str(p, 'name'),
          priceCents: optNum(p, 'price_cents'),
          because: str(p, 'because'),
          tabs: num(p, 'tabs'),
        }),
      );
    },
    async requestBillByStaff(tabId) {
      await call('request_bill_by_staff', { p_tab_id: tabId });
    },
    async reissueSecret(tabId) {
      const r = asRaw(await call('reissue_secret', { p_tab_id: tabId }));
      return { tabId: str(r, 'tab_id'), secret: str(r, 'secret') };
    },

    async listTabs(day) {
      return asArray(await call('list_tabs', { p_day: day ?? null })).map(toManagerTab);
    },
    async pendingBills() {
      return asArray(await call('pending_bills')).map(toManagerTab);
    },
    async closeTab(tabId, method, acceptUnpriced = false): Promise<ClosedBill> {
      const r = asRaw(
        await call('close_tab', {
          p_tab_id: tabId,
          p_payment_method: method,
          p_accept_unpriced: acceptUnpriced,
        }),
      );
      return { totalCents: num(r, 'total_cents'), unpricedUnits: num(r, 'unpriced_units') };
    },
    async reopenTab(tabId) {
      await call('reopen_tab', { p_tab_id: tabId });
    },
    async voidTab(tabId) {
      await call('void_tab', { p_tab_id: tabId });
    },
    async catalogList(): Promise<CatalogEntry[]> {
      return asArray(await call('catalog_list')).map((r) => ({
        ...toMenuItem(r),
        mergedInto: optStr(r, 'merged_into'),
      }));
    },
    setPrice: (id, priceCents) => ok('catalog_set_price', { p_id: id, p_price_cents: priceCents }),
    approveItem: (id) => ok('catalog_approve', { p_id: id }),
    renameItem: (id, name) => ok('catalog_rename', { p_id: id, p_name: name }),
    archiveItem: (id) => ok('catalog_archive', { p_id: id }),
    mergeItem: (fromId, intoId) => ok('catalog_merge', { p_from: fromId, p_into: intoId }),
    addCatalogItem: (name, category, priceCents) =>
      ok('catalog_add', {
        p_name: name,
        p_category: category ?? null,
        p_price_cents: priceCents ?? null,
      }),
    async staffList(): Promise<StaffEntry[]> {
      return asArray(await call('staff_list')).map((r) => ({
        userId: str(r, 'user_id'),
        name: str(r, 'name'),
        email: optStr(r, 'email'),
        role: str(r, 'role') as StaffRole,
        active: bool(r, 'active'),
      }));
    },
    async setStaffActive(userId, active) {
      await call('staff_set_active', { p_user_id: userId, p_active: active });
    },
    async setStaffRole(userId, role) {
      await call('staff_set_role', { p_user_id: userId, p_role: role });
    },
    async salesReport(day) {
      return toSalesReport(await call('sales_report', { p_day: day ?? null }));
    },

    // Ao vivo não há evento de mudança: as telas consultam em intervalo curto.
    subscribe: () => () => undefined,
  };
}
