import { normalizeName, serviceDay } from './rules';
import type { CatalogItem, ComandaState, StaffMember, Tab, TabItem } from './types';

/**
 * Dados de demonstração do protótipo. Nomes, telefones e PREÇOS são fictícios.
 * Os horários são relativos a `now`, então a demonstração sempre parece "hoje".
 */

/** [nome, categoria, usos, preço em centavos] */
const CATALOG: [string, string, number, number][] = [
  ['Chopp', 'Cervejas', 40, 1200],
  ['Cerveja long neck', 'Cervejas', 28, 1400],
  ['Cerveja 600ml', 'Cervejas', 22, 1800],
  ['Caipirinha', 'Drinks', 18, 2200],
  ['Caipiroska', 'Drinks', 9, 2400],
  ['Gin tônica', 'Drinks', 7, 2800],
  ['Refrigerante lata', 'Sem álcool', 15, 800],
  ['Água sem gás', 'Sem álcool', 12, 600],
  ['Água com gás', 'Sem álcool', 6, 700],
  ['Suco natural', 'Sem álcool', 5, 1200],
  ['Dose de cachaça', 'Doses', 8, 900],
  ['Dose de whisky', 'Doses', 6, 1800],
  ['Porção de batata frita', 'Porções', 20, 3200],
  ['Porção de calabresa', 'Porções', 11, 3400],
  ['Isca de frango', 'Porções', 9, 3800],
  ['Pastel (6 un.)', 'Porções', 8, 2800],
  ['Tábua de frios', 'Porções', 4, 5800],
  ['Hambúrguer artesanal', 'Pratos', 10, 3600],
];

/** Sugestões que um garçom digitou: ainda sem categoria nem preço, o gerente precisa curar. */
const SUGGESTED: [string, number][] = [
  ['Cerveja artesanal IPA', 3],
  ['Caldinho de feijão', 2],
];

function catalogItem(
  name: string,
  category: string,
  useCount: number,
  status: CatalogItem['status'],
  priceCents?: number,
): CatalogItem {
  return {
    id: `cat-${normalizeName(name).replace(/[^a-z0-9]+/g, '-')}`,
    name,
    normalized: normalizeName(name),
    category,
    priceCents,
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

const DAY_MS = 24 * 60 * 60 * 1000;

export function createDemoState(now: number): ComandaState {
  const today = serviceDay(now);
  const yesterday = serviceDay(now - DAY_MS);
  const minutes = (n: number) => now - n * 60 * 1000;

  const catalog = [
    ...CATALOG.map(([n, c, u, p]) => catalogItem(n, c, u, 'approved', p)),
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
    // Ontem: histórico que alimenta o relatório e as sugestões de venda casada.
    tab('tab-diego', 1, yesterday, 'Diego Alves', '5551999990303', 'confirmado', 24 * 60 - 120),
    tab(
      'tab-elisa',
      2,
      yesterday,
      'Elisa Prado',
      '5551999990404',
      'confirmado',
      24 * 60 - 150,
      '2',
    ),
    tab('tab-fabio', 3, yesterday, 'Fábio Reis', '5551999990505', 'informado', 24 * 60 - 170, '6'),
    tab('tab-gina', 4, yesterday, 'Gina Melo', '5551999990606', 'confirmado', 24 * 60 - 200, '3'),
    tab('tab-hugo', 5, yesterday, 'Hugo Dias', '5551999990707', 'confirmado', 24 * 60 - 230, '8'),
    tab('tab-iara', 6, yesterday, 'Iara Neves', undefined, 'sem_celular', 24 * 60 - 260, '1'),
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
    const item = cat(name);
    return {
      id: `item-demo-${n}`,
      tabId,
      catalogItemId: item.id,
      nameSnapshot: name,
      qty,
      unitPriceCents: item.priceCents,
      addedBy: by,
      createdAt: minutes(agoMin),
    };
  };

  const y = 24 * 60; // minutos em um dia
  const items: TabItem[] = [
    // Hoje
    line('tab-ana', 'Chopp', 3, 80),
    line('tab-ana', 'Porção de batata frita', 1, 75),
    line('tab-ana', 'Chopp', 2, 40),
    line('tab-bruno', 'Cerveja long neck', 2, 50),
    line('tab-bruno', 'Pastel (6 un.)', 1, 45),
    line('tab-carla', 'Caipirinha', 2, 20),
    // Ontem: pares que se repetem (chopp + batata, caipirinha + isca, long neck + calabresa...)
    line('tab-diego', 'Cerveja 600ml', 4, y - 90),
    line('tab-diego', 'Isca de frango', 1, y - 80),
    line('tab-elisa', 'Chopp', 3, y - 130),
    line('tab-elisa', 'Porção de batata frita', 1, y - 125),
    line('tab-elisa', 'Refrigerante lata', 1, y - 120),
    line('tab-fabio', 'Chopp', 4, y - 150),
    line('tab-fabio', 'Porção de batata frita', 1, y - 145),
    line('tab-fabio', 'Isca de frango', 1, y - 140),
    line('tab-gina', 'Caipirinha', 3, y - 180),
    line('tab-gina', 'Isca de frango', 1, y - 175),
    line('tab-gina', 'Gin tônica', 1, y - 170),
    line('tab-hugo', 'Cerveja long neck', 3, y - 210),
    line('tab-hugo', 'Porção de calabresa', 1, y - 205),
    line('tab-hugo', 'Hambúrguer artesanal', 1, y - 200),
    line('tab-iara', 'Caipirinha', 2, y - 240),
    line('tab-iara', 'Isca de frango', 1, y - 235),
    line('tab-iara', 'Água sem gás', 2, y - 230),
  ];

  return { tabs, items, catalog, staff: STAFF };
}
