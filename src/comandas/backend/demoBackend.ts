import { createDemoState } from '../demoData';
import {
  addCatalogItem,
  addItem,
  approveCatalogItem,
  archiveCatalogItem,
  closeTab,
  confirmPhone,
  findTabs,
  mergeCatalogItem,
  openTab,
  remainingQty,
  removeOne,
  renameCatalogItem,
  reopenTab,
  requestBill,
  reverseItem,
  salesReport,
  serviceDay,
  setCatalogPrice,
  setStaffActive,
  summarizeItems,
  suggestPairings,
  tabStatus,
  tabTotals,
  voidTab,
  type Result,
} from '../rules';
import type { ComandaState, StaffMember, Tab } from '../types';
import {
  ComandaError,
  type ComandaBackend,
  type ComandaErrorCode,
  type Consumption,
  type ManagerTab,
  type MenuItem,
  type StaffRole,
  type TabDetail,
  type Whoami,
} from './types';

/**
 * Fonte de DEMONSTRAÇÃO: as regras de src/comandas/rules.ts sobre um estado que
 * vive em localStorage. Não há servidor: nada sai do aparelho e os dados são
 * fictícios. Acompanha as outras abas do MESMO navegador pelo evento `storage`
 * (abra "Cliente" numa aba e "Garçom" noutra). Serve ao preview, à apresentação e
 * aos testes E2E; o modo ao vivo usa `supabaseBackend`.
 */

const STORAGE_KEY = 'jg-comanda:demo-v2';
const SESSION_KEY = 'jg-comanda:staff';

export interface DemoControls {
  /** Restaura os dados fictícios. */
  reset(): void;
  /** Quem a demonstração diz que está logado (escolha de nome, sem senha). */
  staffId(): string | null;
  signInAs(staffId: string | null): void;
  staff(): StaffMember[];
}

export type DemoBackend = ComandaBackend & { demo: DemoControls };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // sem armazenamento (modo privado): o estado segue vivo só nesta aba
  }
}
function load(): ComandaState {
  try {
    const raw = read(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ComandaState;
  } catch {
    // armazenamento corrompido: recomeça da demonstração
  }
  return createDemoState(Date.now());
}

const iso = (ms: number | undefined) => (ms === undefined ? undefined : new Date(ms).toISOString());

export function createDemoBackend(): DemoBackend {
  let state = load();
  let staffId = read(SESSION_KEY);
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const replace = (next: ComandaState) => {
    state = next;
    write(STORAGE_KEY, JSON.stringify(next));
    notify();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          state = JSON.parse(e.newValue) as ComandaState;
        } catch {
          return;
        }
        notify();
      } else if (e.key === SESSION_KEY) {
        staffId = e.newValue;
        notify();
      }
    });
  }

  /** Aplica uma regra pura; falha vira ComandaError com o mesmo código do banco. */
  function run<T extends { ok: boolean }>(fn: (s: ComandaState, now: number) => Result<T>): T {
    const { state: next, result } = fn(state, Date.now());
    if (next !== state) replace(next);
    return result;
  }
  function must<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
    if (!result.ok) {
      const reason = (result as unknown as { reason?: string }).reason ?? 'unknown';
      throw new ComandaError(reason as ComandaErrorCode);
    }
    return result as Extract<T, { ok: true }>;
  }

  const me = (): StaffMember | undefined => state.staff.find((s) => s.id === staffId);
  function requireStaff(roles: StaffRole[]): StaffMember {
    const s = me();
    if (!s || !s.active || !roles.includes(s.role)) throw new ComandaError('forbidden');
    return s;
  }
  const either: StaffRole[] = ['garcom', 'gerente'];

  function consumption(tabId: string): Consumption {
    const totals = tabTotals(state, tabId);
    return {
      lines: summarizeItems(state, tabId).map((l) => ({
        catalogItemId: l.catalogItemId,
        name: l.name,
        qty: l.qty,
        totalCents: l.totalCents,
        unpricedQty: l.unpricedQty,
      })),
      units: totals.units,
      totalCents: totals.totalCents,
      unpricedUnits: totals.unpricedUnits,
    };
  }

  const managerTab = (t: Tab): ManagerTab => ({
    ...consumption(t.id),
    id: t.id,
    code: t.code,
    customerName: t.customerName,
    phone: t.phone,
    phoneStatus: t.phoneStatus,
    tableLabel: t.tableLabel,
    status: tabStatus(t),
    openedAt: new Date(t.openedAt).toISOString(),
    billRequestedAt: iso(t.billRequestedAt),
    closedAt: iso(t.closedAt),
    closedTotalCents: t.closedTotalCents,
    paymentMethod: t.paymentMethod,
  });

  const catalogItem = (id: string) => state.catalog.find((c) => c.id === id);
  const today = () => serviceDay(Date.now());
  const whoamiNow = (): Whoami => {
    const s = me();
    return s
      ? { registered: true, name: s.name, role: s.role, active: s.active }
      : { registered: false };
  };

  return {
    mode: 'demo',

    // --- Cliente ---
    async openTab({ name, phone, table }) {
      const r = must(
        run((s, now) => openTab(s, { name, phone, tableLabel: table, openedBy: 'cliente' }, now)),
      );
      // No demo o "segredo" é o próprio id: só impede abrir comanda alheia por engano.
      return { tabId: r.tab.id, code: r.tab.code, secret: r.tab.id };
    },
    async getMyTab(tabId, secret) {
      const t = state.tabs.find((x) => x.id === tabId);
      if (!t || secret !== t.id) throw new ComandaError('not-found');
      const status = tabStatus(t);
      return {
        ...consumption(t.id),
        id: t.id,
        code: t.code,
        customerName: t.customerName,
        tableLabel: t.tableLabel,
        phoneStatus: t.phoneStatus,
        status,
        serviceDay: t.serviceDay,
        billRequestedAt: iso(t.billRequestedAt),
        closedAt: iso(t.closedAt),
        closedTotalCents: status === 'fechada' ? t.closedTotalCents : undefined,
      };
    },
    async requestBill(tabId, secret) {
      if (state.tabs.find((x) => x.id === tabId)?.id !== secret)
        throw new ComandaError('not-found');
      must(run((s, now) => requestBill(s, tabId, now)));
    },

    // --- Equipe ---
    async whoami() {
      return whoamiNow();
    },
    async registerStaff() {
      return whoamiNow();
    },
    async menu() {
      requireStaff(either);
      return state.catalog
        .filter((c) => c.status !== 'archived' && !c.mergedInto)
        .map((c): MenuItem => ({
          id: c.id,
          name: c.name,
          category: c.category,
          priceCents: c.priceCents,
          status: c.status,
          useCount: c.useCount,
        }))
        .sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name, 'pt-BR'));
    },
    async findTabs(query) {
      requireStaff(either);
      return findTabs(state, query, today()).map((t) => ({
        id: t.id,
        code: t.code,
        customerName: t.customerName,
        phoneLast4: t.phoneLast4,
        phoneStatus: t.phoneStatus,
        tableLabel: t.tableLabel,
        status: tabStatus(t),
      }));
    },
    async getTab(tabId) {
      const s = requireStaff(either);
      const t = state.tabs.find((x) => x.id === tabId);
      if (!t || (s.role === 'garcom' && (t.serviceDay !== today() || t.voidedAt))) {
        throw new ComandaError('not-found');
      }
      const detail: TabDetail = {
        ...consumption(t.id),
        id: t.id,
        code: t.code,
        customerName: t.customerName,
        phone: s.role === 'gerente' ? t.phone : undefined,
        phoneLast4: t.phoneLast4,
        phoneStatus: t.phoneStatus,
        tableLabel: t.tableLabel,
        status: tabStatus(t),
        serviceDay: t.serviceDay,
        openedAt: new Date(t.openedAt).toISOString(),
        billRequestedAt: iso(t.billRequestedAt),
        closedAt: iso(t.closedAt),
        closedTotalCents: t.closedTotalCents,
        paymentMethod: t.paymentMethod,
        ledger: state.items
          .filter((i) => i.tabId === t.id)
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((i) => ({
            id: i.id,
            name: i.nameSnapshot,
            qty: i.qty,
            unitPriceCents: i.unitPriceCents,
            reversesItemId: i.reversesItemId,
            remaining: remainingQty(state, i),
            createdAt: new Date(i.createdAt).toISOString(),
            addedBy: i.addedBy,
          })),
      };
      return detail;
    },
    async openTabByStaff(name, table) {
      requireStaff(either);
      const r = must(
        run((s, now) => openTab(s, { name, tableLabel: table, openedBy: 'garcom' }, now)),
      );
      return { tabId: r.tab.id, code: r.tab.code };
    },
    async confirmPhone(tabId) {
      requireStaff(either);
      return run((s) => confirmPhone(s, tabId)).ok;
    },
    async addItem({ tabId, catalogItemId, name, qty }) {
      const staff = requireStaff(either);
      const r = must(
        run((s, now) => addItem(s, { tabId, catalogItemId, name, qty, by: staff.name }, now)),
      );
      return { itemId: r.item.id, name: r.item.nameSnapshot, created: r.created };
    },
    async reverseItem(itemId, qty) {
      const staff = requireStaff(either);
      return run((s, now) => reverseItem(s, itemId, staff.name, now, qty)).ok;
    },
    async removeOne(tabId, catalogItemId) {
      const staff = requireStaff(either);
      return run((s, now) => removeOne(s, tabId, catalogItemId, staff.name, now)).ok;
    },
    async suggestPairings(tabId, limit = 3) {
      requireStaff(either);
      return suggestPairings(state, tabId, limit).map((p) => ({
        catalogItemId: p.item.id,
        name: p.item.name,
        priceCents: p.item.priceCents,
        because: p.because,
        tabs: p.tabs,
      }));
    },
    async requestBillByStaff(tabId) {
      requireStaff(either);
      must(run((s, now) => requestBill(s, tabId, now)));
    },
    async reissueSecret(tabId) {
      requireStaff(either);
      if (!state.tabs.some((t) => t.id === tabId && t.phone)) throw new ComandaError('not-found');
      return { tabId, secret: tabId };
    },

    // --- Gerente ---
    async listTabs(day) {
      requireStaff(['gerente']);
      return state.tabs
        .filter((t) => t.serviceDay === (day ?? today()))
        .sort((a, b) => b.code - a.code)
        .map(managerTab);
    },
    async pendingBills() {
      requireStaff(['gerente']);
      return state.tabs
        .filter((t) => tabStatus(t) === 'conta_pedida' && t.serviceDay === today())
        .sort((a, b) => (a.billRequestedAt ?? 0) - (b.billRequestedAt ?? 0))
        .map(managerTab);
    },
    async closeTab(tabId, method, acceptUnpriced = false) {
      requireStaff(['gerente']);
      const r = must(run((s, now) => closeTab(s, tabId, method, acceptUnpriced, now)));
      return { totalCents: r.totalCents, unpricedUnits: r.unpricedUnits };
    },
    async reopenTab(tabId) {
      requireStaff(['gerente']);
      if (!run((s, now) => reopenTab(s, tabId, now)).ok) throw new ComandaError('cannot-reopen');
    },
    async voidTab(tabId) {
      requireStaff(['gerente']);
      const t = state.tabs.find((x) => x.id === tabId);
      if (!t) throw new ComandaError('not-found');
      if (tabStatus(t) === 'fechada' || tabStatus(t) === 'anulada') {
        throw new ComandaError('tab-closed');
      }
      run((s, now) => voidTab(s, tabId, now));
    },
    async catalogList() {
      requireStaff(['gerente']);
      return state.catalog.map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        priceCents: c.priceCents,
        status: c.status,
        useCount: c.useCount,
        mergedInto: c.mergedInto,
      }));
    },
    async setPrice(id, priceCents) {
      requireStaff(['gerente']);
      if (priceCents !== null && (!Number.isInteger(priceCents) || priceCents < 0)) {
        throw new ComandaError('invalid-price');
      }
      if (!catalogItem(id)) return false;
      replace(setCatalogPrice(state, id, priceCents ?? undefined));
      return true;
    },
    async approveItem(id) {
      requireStaff(['gerente']);
      if (!catalogItem(id)) return false;
      replace(approveCatalogItem(state, id));
      return true;
    },
    async renameItem(id, name) {
      requireStaff(['gerente']);
      const clean = name.trim();
      if (!catalogItem(id) || clean === '') return false;
      const next = renameCatalogItem(state, id, clean);
      const renamed = next.catalog.find((c) => c.id === id)!;
      if (
        next.catalog.some(
          (c) => c.id !== id && c.normalized === renamed.normalized && c.status !== 'archived',
        )
      ) {
        throw new ComandaError('name-taken');
      }
      replace(next);
      return true;
    },
    async archiveItem(id) {
      requireStaff(['gerente']);
      if (!catalogItem(id)) return false;
      replace(archiveCatalogItem(state, id));
      return true;
    },
    async mergeItem(fromId, intoId) {
      requireStaff(['gerente']);
      const next = mergeCatalogItem(state, fromId, intoId);
      if (next === state) return false;
      replace(next);
      return true;
    },
    async addCatalogItem(name, category, priceCents) {
      requireStaff(['gerente']);
      const next = addCatalogItem(state, name, category ?? '', priceCents);
      if (next === state) return false;
      replace(next);
      return true;
    },
    async staffList() {
      requireStaff(['gerente']);
      return state.staff.map((s) => ({
        userId: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
        active: s.active,
      }));
    },
    async setStaffActive(userId, active) {
      const self = requireStaff(['gerente']);
      if (userId === self.id && !active) throw new ComandaError('cannot-deactivate-self');
      replace(setStaffActive(state, userId, active));
    },
    async setStaffRole(userId, role) {
      const self = requireStaff(['gerente']);
      if (userId === self.id) throw new ComandaError('cannot-change-own-role');
      replace({ ...state, staff: state.staff.map((s) => (s.id === userId ? { ...s, role } : s)) });
    },
    async salesReport(day) {
      requireStaff(['gerente']);
      return salesReport(state, day ?? today());
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    demo: {
      reset() {
        replace(createDemoState(Date.now()));
      },
      staffId: () => staffId,
      signInAs(id) {
        staffId = id;
        write(SESSION_KEY, id);
        notify();
      },
      staff: () => state.staff,
    },
  };
}
