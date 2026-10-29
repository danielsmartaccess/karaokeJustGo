import { normalizeName, serviceDay } from './rules';
import type { CatalogItem, ComandaState, StaffMember, Tab, TabItem } from './types';

/**
 * Dados de demonstração do protótipo. Telefones e nomes são fictícios.
 * Os horários são relativos a `now`, então a demonstração sempre parece "hoje".
 */

const CATALOG: [string, string, number][] = [
  ['Chopp', 'Bebidas', 40],
  ['Cerveja long neck', 'Bebidas', 28],
  ['Cerveja 600ml', 'Bebidas', 22],
  ['Caipirinha', 'Bebidas', 18],
  ['Caipiroska', 'Bebidas', 9],
  ['Gin tônica', 'Bebidas', 7],
  ['Refrigerante lata', 'Bebidas', 15],
  ['Água sem gás', 'Bebidas', 12],
  ['Água com gás', 'Bebidas', 6],
  ['Suco natural', 'Bebidas', 5],
  ['Dose de cachaça', 'Doses', 8],
  ['Dose de whisky', 'Doses', 6],
  ['Porção de batata frita', 'Porções', 20],
  ['Porção de calabresa', 'Porções', 11],
  ['Isca de frango', 'Porções', 9],
  ['Pastel (6 un.)', 'Porções', 8],
  ['Tábua de frios', 'Porções', 4],
  ['Hambúrguer artesanal', 'Pratos', 10],
];

/** Sugestões que um garçom digitou e o gerente ainda não curou. */
const SUGGESTED: [string, number][] = [
  ['Cerveja artesanal IPA', 3],
  ['Caldinho de feijão', 2],
];

function catalogItem(
  name: string,
  category: string,
  useCount: number,
  status: CatalogItem['status'],
): CatalogItem {
  return {
    id: `cat-${normalizeName(name).replace(/[^a-z0-9]+/g, '-')}`,
    name,
    normalized: normalizeName(name),
    category,
    status,
    useCount,
  };
}

const STAFF: StaffMember[] = [
  {
    id: 'staff-carlos',
    name: 'Carlos',
    email: 'carlos@exemplo.test',
    role: 'garcom',
    active: true,
  },
  {
    id: 'staff-marina',
    name: 'Marina',
    email: 'marina@exemplo.test',
    role: 'gerente',
    active: true,
  },
  { id: 'staff-joao', name: 'João', email: 'joao@exemplo.test', role: 'garcom', active: false },
];

export function createDemoState(now: number): ComandaState {
  const today = serviceDay(now);
  const yesterday = serviceDay(now - 24 * 60 * 60 * 1000);
  const minutes = (n: number) => now - n * 60 * 1000;

  const catalog = [
    ...CATALOG.map(([n, c, u]) => catalogItem(n, c, u, 'approved')),
    ...SUGGESTED.map(([n, u]) => catalogItem(n, 'Outros', u, 'suggested')),
  ];
  const cat = (name: string) => catalog.find((c) => c.name === name)!;

  const tab = (
    id: string,
    code: number,
    day: string,
    name: string,
    phone: string | undefined,
    status: Tab['phoneStatus'],
    openedMinutesAgo: number,
    table?: string,
  ): Tab => ({
    id,
    code,
    customerName: name,
    phone,
    phoneLast4: phone?.slice(-4),
    phoneStatus: status,
    tableLabel: table,
    serviceDay: day,
    openedAt: minutes(openedMinutesAgo),
    openedBy: phone ? 'cliente' : 'garcom',
  });

  const tabs: Tab[] = [
    tab('tab-ana', 1, today, 'Ana Souza', '5551999990101', 'confirmado', 95, '4'),
    tab('tab-bruno', 2, today, 'Bruno Lima', '5551999990202', 'informado', 60, '7'),
    tab('tab-carla', 3, today, 'Carla (mesa do fundo)', undefined, 'sem_celular', 30, '9'),
    tab('tab-diego', 1, yesterday, 'Diego Alves', '5551999990303', 'confirmado', 24 * 60 - 120),
  ];

  let n = 0;
  const line = (
    tabId: string,
    name: string,
    qty: number,
    agoMin: number,
    by = 'Carlos',
  ): TabItem => {
    n += 1;
    return {
      id: `item-demo-${n}`,
      tabId,
      catalogItemId: cat(name).id,
      nameSnapshot: name,
      qty,
      addedBy: by,
      createdAt: minutes(agoMin),
    };
  };

  const items: TabItem[] = [
    line('tab-ana', 'Chopp', 3, 80),
    line('tab-ana', 'Porção de batata frita', 1, 75),
    line('tab-ana', 'Chopp', 2, 40),
    line('tab-bruno', 'Cerveja long neck', 2, 50),
    line('tab-bruno', 'Pastel (6 un.)', 1, 45),
    line('tab-carla', 'Caipirinha', 2, 20),
    line('tab-diego', 'Cerveja 600ml', 4, 24 * 60 - 90),
    line('tab-diego', 'Isca de frango', 1, 24 * 60 - 80),
  ];

  return { tabs, items, catalog, staff: STAFF };
}
