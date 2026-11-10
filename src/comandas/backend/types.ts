import type { PaymentMethod, PhoneStatus } from '../types';

/**
 * Contrato entre as telas das comandas e a fonte dos dados.
 *
 * Duas implementações: `supabaseBackend` (chama as funções do banco, modo ao vivo)
 * e `demoBackend` (regras locais em localStorage, modo demonstração). As telas só
 * conhecem este arquivo, então trocar a fonte não muda a interface.
 *
 * Tudo é assíncrono e erros viram `ComandaError` com um código curto (o mesmo que
 * o banco devolve em `message`), que `errorMessage()` traduz para o usuário.
 */

export type TabStatus = 'aberta' | 'conta_pedida' | 'fechada' | 'anulada';
export type StaffRole = 'garcom' | 'gerente';
export type CatalogStatus = 'approved' | 'suggested' | 'archived';

export type ComandaErrorCode =
  | 'invalid-name'
  | 'invalid-phone'
  | 'phone-already-open'
  | 'daily-cap'
  | 'not-found'
  | 'tab-not-found'
  | 'tab-not-open-today'
  | 'tab-closed'
  | 'invalid-qty'
  | 'empty-name'
  | 'unpriced-items'
  | 'invalid-payment-method'
  | 'cannot-reopen'
  | 'cannot-deactivate-self'
  | 'cannot-change-own-role'
  | 'name-taken'
  | 'invalid-price'
  | 'forbidden'
  | 'network'
  | 'unknown';

export class ComandaError extends Error {
  constructor(
    public readonly code: ComandaErrorCode,
    detail?: string,
  ) {
    super(detail ?? code);
    this.name = 'ComandaError';
  }
}

// --- Consumo ---------------------------------------------------------------------

export interface SummaryLine {
  catalogItemId: string;
  name: string;
  qty: number;
  totalCents: number;
  unpricedQty: number;
}

export interface Consumption {
  lines: SummaryLine[];
  units: number;
  /** Parcial até o fechamento. Itens sem preço ficam de fora e são contados à parte. */
  totalCents: number;
  unpricedUnits: number;
}

// --- Cliente ---------------------------------------------------------------------

export interface OpenedTab {
  tabId: string;
  code: number;
  /** Entregue UMA vez; o app guarda no aparelho. O banco guarda só o hash. */
  secret: string;
}

export interface MyTab extends Consumption {
  id: string;
  code: number;
  customerName: string;
  tableLabel?: string;
  phoneStatus: PhoneStatus;
  status: TabStatus;
  serviceDay: string;
  billRequestedAt?: string;
  closedAt?: string;
  /** Conta final, congelada. Só existe com status 'fechada'. */
  closedTotalCents?: number;
}

// --- Equipe ----------------------------------------------------------------------

export interface Whoami {
  registered: boolean;
  name?: string;
  role?: StaffRole;
  active?: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  priceCents?: number;
  status: CatalogStatus;
  useCount: number;
}

export interface TabListItem {
  id: string;
  code: number;
  customerName: string;
  phoneLast4?: string;
  phoneStatus: PhoneStatus;
  tableLabel?: string;
  status: TabStatus;
}

export interface LedgerLine {
  id: string;
  name: string;
  qty: number;
  unitPriceCents?: number;
  reversesItemId?: string;
  /** Unidades da linha que ainda não foram estornadas. */
  remaining: number;
  createdAt: string;
  addedBy: string;
}

export interface TabDetail extends Consumption {
  id: string;
  code: number;
  customerName: string;
  /** Só o gerente recebe o número inteiro. */
  phone?: string;
  phoneLast4?: string;
  phoneStatus: PhoneStatus;
  tableLabel?: string;
  status: TabStatus;
  serviceDay: string;
  openedAt: string;
  billRequestedAt?: string;
  closedAt?: string;
  closedTotalCents?: number;
  paymentMethod?: PaymentMethod;
  ledger: LedgerLine[];
}

export interface AddedItem {
  itemId: string;
  name: string;
  /** Item digitado que não existia: virou sugestão para o gerente curar. */
  created: boolean;
}

export interface Pairing {
  catalogItemId: string;
  name: string;
  priceCents?: number;
  because: string;
  tabs: number;
}

// --- Gerente ---------------------------------------------------------------------

export interface ManagerTab extends Consumption {
  id: string;
  code: number;
  customerName: string;
  phone?: string;
  phoneStatus: PhoneStatus;
  tableLabel?: string;
  status: TabStatus;
  openedAt: string;
  billRequestedAt?: string;
  closedAt?: string;
  closedTotalCents?: number;
  paymentMethod?: PaymentMethod;
}

export interface CatalogEntry extends MenuItem {
  mergedInto?: string;
}

export interface StaffEntry {
  userId: string;
  name: string;
  email?: string;
  role: StaffRole;
  active: boolean;
}

export interface SalesLine {
  catalogItemId: string;
  name: string;
  units: number;
  revenueCents: number;
}

export interface SalesReport {
  tabs: number;
  units: number;
  revenueCents: number;
  unpricedUnits: number;
  avgTicketCents: number;
  unitsPerTab: number;
  top: SalesLine[];
  unpricedItems: SalesLine[];
}

export interface ClosedBill {
  totalCents: number;
  unpricedUnits: number;
}

// --- O contrato --------------------------------------------------------------------

export interface ComandaBackend {
  readonly mode: 'live' | 'demo';

  // Cliente (sem login)
  openTab(input: { name: string; phone: string; table?: string }): Promise<OpenedTab>;
  getMyTab(tabId: string, secret: string): Promise<MyTab>;
  requestBill(tabId: string, secret: string): Promise<void>;

  // Equipe (garçom e gerente)
  whoami(): Promise<Whoami>;
  registerStaff(name: string): Promise<Whoami>;
  menu(): Promise<MenuItem[]>;
  findTabs(query: string): Promise<TabListItem[]>;
  getTab(tabId: string): Promise<TabDetail>;
  openTabByStaff(name: string, table?: string): Promise<{ tabId: string; code: number }>;
  confirmPhone(tabId: string): Promise<boolean>;
  addItem(input: {
    tabId: string;
    catalogItemId?: string;
    name?: string;
    qty: number;
  }): Promise<AddedItem>;
  reverseItem(itemId: string, qty?: number): Promise<boolean>;
  removeOne(tabId: string, catalogItemId: string): Promise<boolean>;
  suggestPairings(tabId: string, limit?: number): Promise<Pairing[]>;
  requestBillByStaff(tabId: string): Promise<void>;
  reissueSecret(tabId: string): Promise<{ tabId: string; secret: string }>;

  // Gerente
  listTabs(day?: string): Promise<ManagerTab[]>;
  pendingBills(): Promise<ManagerTab[]>;
  closeTab(tabId: string, method: PaymentMethod, acceptUnpriced?: boolean): Promise<ClosedBill>;
  reopenTab(tabId: string): Promise<void>;
  voidTab(tabId: string): Promise<void>;
  catalogList(): Promise<CatalogEntry[]>;
  setPrice(id: string, priceCents: number | null): Promise<boolean>;
  approveItem(id: string): Promise<boolean>;
  renameItem(id: string, name: string): Promise<boolean>;
  archiveItem(id: string): Promise<boolean>;
  mergeItem(fromId: string, intoId: string): Promise<boolean>;
  addCatalogItem(name: string, category?: string, priceCents?: number): Promise<boolean>;
  staffList(): Promise<StaffEntry[]>;
  setStaffActive(userId: string, active: boolean): Promise<void>;
  setStaffRole(userId: string, role: StaffRole): Promise<void>;
  salesReport(day?: string): Promise<SalesReport>;

  /** Avisa que os dados podem ter mudado (outra aba, no modo demonstração). Devolve o cancelamento. */
  subscribe(listener: () => void): () => void;
}
