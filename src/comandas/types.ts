/**
 * Modelo de domínio das comandas.
 *
 * PROTÓTIPO: estes tipos espelham o desenho em docs/COMANDAS.md, mas hoje vivem
 * só no navegador (modo demonstração). Quando existir o banco, as mesmas formas
 * viram tabelas; as regras de src/comandas/rules.ts continuam valendo.
 */

/** Situação do celular informado pelo cliente. */
export type PhoneStatus = 'informado' | 'confirmado' | 'sem_celular';

export interface Tab {
  id: string;
  /** Número curto da noite ("Comanda 27"), sequencial por dia de serviço. */
  code: number;
  customerName: string;
  /** Celular com DDI, só dígitos (ex.: 5551999990101). Ausente em `sem_celular`. */
  phone?: string;
  phoneLast4?: string;
  phoneStatus: PhoneStatus;
  tableLabel?: string;
  /** Dia de serviço (AAAA-MM-DD). A comanda só aceita itens neste dia. */
  serviceDay: string;
  openedAt: number;
  /** Quem abriu: o próprio cliente ou o garçom (contingência). */
  openedBy: 'cliente' | 'garcom';
  voidedAt?: number;
  /** Ausente = aberta. Anulada continua sendo `voidedAt`. */
  status?: 'aberta' | 'conta_pedida' | 'fechada';
  billRequestedAt?: number;
  closedAt?: number;
  /** Conta final, congelada no fechamento. */
  closedTotalCents?: number;
  closedUnpricedUnits?: number;
  paymentMethod?: PaymentMethod;
}

/** Como a conta foi paga. O app ainda não cobra: o gerente só registra. */
export type PaymentMethod = 'dinheiro' | 'cartao' | 'pix' | 'outro';

/**
 * Linha do livro-razão de itens. Só se acrescenta: estorno é uma linha de
 * `qty` negativa apontando para a original em `reversesItemId`.
 */
export interface TabItem {
  id: string;
  tabId: string;
  catalogItemId: string;
  /** Nome do item no momento do lançamento (renomear o catálogo não altera). */
  nameSnapshot: string;
  qty: number;
  /** Preço unitário (centavos) NO MOMENTO do lançamento. Mudar o preço do catálogo não altera vendas passadas. */
  unitPriceCents?: number;
  reversesItemId?: string;
  addedBy: string;
  createdAt: number;
}

export type CatalogStatus = 'approved' | 'suggested' | 'archived';

export interface CatalogItem {
  id: string;
  name: string;
  normalized: string;
  category: string;
  /** Preço de venda em centavos. Ausente = ainda sem preço (aparece como alerta ao gerente). */
  priceCents?: number;
  status: CatalogStatus;
  useCount: number;
  lastUsedAt?: number;
  /** Item para o qual este foi juntado (duplicata). Os totais usam o destino. */
  mergedInto?: string;
}

export type StaffRole = 'garcom' | 'gerente';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  /** Pendente (false) até o gerente ativar. */
  active: boolean;
}

export interface ComandaState {
  tabs: Tab[];
  items: TabItem[];
  catalog: CatalogItem[];
  staff: StaffMember[];
}

/** Linha agrupada para exibição: "3× Chopp". */
export interface ItemSummaryLine {
  catalogItemId: string;
  name: string;
  qty: number;
  /** Soma de quantidade x preço das linhas com preço (já descontados os estornos). */
  totalCents: number;
  /** Unidades sem preço: ficam fora do total e são sinalizadas. */
  unpricedQty: number;
}
