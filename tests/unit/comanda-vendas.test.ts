import { describe, expect, it } from 'vitest';
import { createDemoState } from '@/comandas/demoData';
import {
  addCatalogItem,
  addItem,
  menuByCategory,
  parsePriceCents,
  remainingQty,
  removeOne,
  reverseItem,
  salesReport,
  serviceDay,
  setCatalogPrice,
  suggestPairings,
  summarizeItems,
  tabTotals,
  voidTab,
} from '@/comandas/rules';

/**
 * Regras de venda das comandas: preço guardado na hora do lançamento, total
 * parcial, estorno parcial, venda sugestiva e relatório do gerente.
 */

const NOITE = new Date(2026, 9, 30, 22, 0, 0).getTime();
const HOJE = serviceDay(NOITE);
const ONTEM = serviceDay(NOITE - 24 * 60 * 60 * 1000);

const demo = () => createDemoState(NOITE);
const tabByName = (state: ReturnType<typeof demo>, name: string) =>
  state.tabs.find((t) => t.customerName.startsWith(name))!;
const itemByName = (state: ReturnType<typeof demo>, name: string) =>
  state.catalog.find((c) => c.name === name)!;

describe('preço e total da comanda', () => {
  it('soma quantidade x preço: 5 chopps a R$ 12,00 + 1 porção a R$ 32,00', () => {
    const state = demo();
    const ana = tabByName(state, 'Ana');
    expect(tabTotals(state, ana.id)).toEqual({ units: 6, totalCents: 9200, unpricedUnits: 0 });
  });

  it('o lançamento grava o preço da hora', () => {
    const state = demo();
    const ana = tabByName(state, 'Ana');
    const caipirinha = itemByName(state, 'Caipirinha');
    const r = addItem(
      state,
      { tabId: ana.id, catalogItemId: caipirinha.id, qty: 1, by: 'Carlos' },
      NOITE,
    );
    if (!r.result.ok) throw new Error('falhou');
    expect(r.result.item.unitPriceCents).toBe(2200);
  });

  it('mudar o preço do catálogo NÃO altera vendas já lançadas, só as novas', () => {
    const state = demo();
    const ana = tabByName(state, 'Ana');
    const chopp = itemByName(state, 'Chopp');
    const totalAntes = tabTotals(state, ana.id).totalCents;

    const novoPreco = setCatalogPrice(state, chopp.id, 1500); // sobe de R$ 12 para R$ 15
    expect(tabTotals(novoPreco, ana.id).totalCents).toBe(totalAntes);

    const r = addItem(
      novoPreco,
      { tabId: ana.id, catalogItemId: chopp.id, qty: 2, by: 'Carlos' },
      NOITE,
    );
    expect(tabTotals(r.state, ana.id).totalCents).toBe(totalAntes + 2 * 1500);
  });

  it('item sem preço fica fora do total e é contado à parte', () => {
    const state = demo();
    const carla = tabByName(state, 'Carla');
    const r = addItem(
      state,
      { tabId: carla.id, name: 'Suco de maracujá', qty: 2, by: 'Carlos' },
      NOITE,
    );

    expect(tabTotals(r.state, carla.id)).toEqual({
      units: 4,
      totalCents: 4400, // só as 2 caipirinhas de R$ 22,00
      unpricedUnits: 2,
    });
  });

  it('precificar depois fecha a venda feita sem preço (mas não mexe nas que já tinham preço)', () => {
    const state = demo();
    const carla = tabByName(state, 'Carla');
    const vendido = addItem(
      state,
      { tabId: carla.id, name: 'Suco de maracujá', qty: 2, by: 'Carlos' },
      NOITE,
    );
    const item = vendido.state.catalog.find((c) => c.name === 'Suco de maracujá')!;
    expect(tabTotals(vendido.state, carla.id).unpricedUnits).toBe(2);

    const precificado = setCatalogPrice(vendido.state, item.id, 1000);
    expect(tabTotals(precificado, carla.id)).toEqual({
      units: 4,
      totalCents: 4400 + 2 * 1000,
      unpricedUnits: 0,
    });
    expect(salesReport(precificado, HOJE).unpricedUnits).toBe(0);
  });

  it('o gerente precifica um item novo e ele passa a valer nas próximas vendas', () => {
    const state = addCatalogItem(demo(), 'Tábua de queijos', 'Porções', 6500);
    const item = state.catalog.find((c) => c.name === 'Tábua de queijos')!;
    expect(item.priceCents).toBe(6500);
    expect(item.status).toBe('approved');
  });

  it('não aceita preço negativo nem fracionado', () => {
    const state = demo();
    const chopp = itemByName(state, 'Chopp');
    expect(setCatalogPrice(state, chopp.id, -1)).toBe(state);
    expect(setCatalogPrice(state, chopp.id, 12.5)).toBe(state);
  });
});

describe('interpretação do preço digitado', () => {
  it.each([
    ['12,50', 1250],
    ['12.5', 1250],
    ['R$ 8', 800],
    [' r$ 1.250,00 ', 125000],
    ['1.250', 125000],
    ['0', 0],
    ['0,99', 99],
  ])('"%s" vira %d centavos', (texto, centavos) => {
    expect(parsePriceCents(texto)).toBe(centavos);
  });

  it('vazio e texto inválido devolvem indefinido (limpam o preço)', () => {
    expect(parsePriceCents('')).toBeUndefined();
    expect(parsePriceCents('abc')).toBeUndefined();
    expect(parsePriceCents('-5')).toBeUndefined();
    expect(parsePriceCents('9999999')).toBeUndefined();
  });
});

describe('estorno parcial ("−" do cardápio)', () => {
  const linhaDeTres = (state: ReturnType<typeof demo>) => {
    const ana = tabByName(state, 'Ana');
    return state.items.find((i) => i.tabId === ana.id && i.qty === 3)!;
  };

  it('tira uma unidade de uma linha de três: sobram duas', () => {
    const state = demo();
    const linha = linhaDeTres(state);
    const r = reverseItem(state, linha.id, 'Carlos', NOITE, 1);

    expect(r.result.ok).toBe(true);
    expect(remainingQty(r.state, linha)).toBe(2);
    expect(r.state.items.find((i) => i.id === linha.id)).toEqual(linha); // a original não muda
  });

  it('o estorno desconta o preço da hora no total', () => {
    const state = demo();
    const ana = tabByName(state, 'Ana');
    const antes = tabTotals(state, ana.id).totalCents;
    const r = reverseItem(state, linhaDeTres(state).id, 'Carlos', NOITE, 1);
    expect(tabTotals(r.state, ana.id).totalCents).toBe(antes - 1200);
  });

  it('não estorna mais do que resta', () => {
    const state = demo();
    const linha = linhaDeTres(state);
    expect(reverseItem(state, linha.id, 'C', NOITE, 4).result.ok).toBe(false);

    const duas = reverseItem(state, linha.id, 'C', NOITE, 2);
    expect(reverseItem(duas.state, linha.id, 'C', NOITE, 2).result.ok).toBe(false);
    expect(reverseItem(duas.state, linha.id, 'C', NOITE, 1).result.ok).toBe(true);
  });

  it('removeOne tira da linha mais recente que ainda tem saldo', () => {
    const state = demo();
    const ana = tabByName(state, 'Ana');
    const chopp = itemByName(state, 'Chopp');

    // As linhas de Ana: 3 chopps (80 min atrás) e 2 chopps (40 min atrás, a mais recente).
    const r = removeOne(state, ana.id, chopp.id, 'Carlos', NOITE);
    expect(r.result.ok).toBe(true);
    expect(summarizeItems(r.state, ana.id).find((l) => l.name === 'Chopp')?.qty).toBe(4);

    const maisRecente = state.items.find((i) => i.tabId === ana.id && i.qty === 2)!;
    expect(remainingQty(r.state, maisRecente)).toBe(1);
  });

  it('removeOne em item que a comanda não tem não faz nada', () => {
    const state = demo();
    const ana = tabByName(state, 'Ana');
    const r = removeOne(state, ana.id, itemByName(state, 'Gin tônica').id, 'Carlos', NOITE);
    expect(r.result.ok).toBe(false);
    expect(r.state).toBe(state);
  });

  it('desfazer o último toque devolve o total ao valor anterior', () => {
    const state = demo();
    const ana = tabByName(state, 'Ana');
    const caipirinha = itemByName(state, 'Caipirinha');
    const antes = tabTotals(state, ana.id).totalCents;

    const add = addItem(
      state,
      { tabId: ana.id, catalogItemId: caipirinha.id, qty: 1, by: 'C' },
      NOITE,
    );
    if (!add.result.ok) throw new Error('falhou');
    const desfeito = reverseItem(add.state, add.result.item.id, 'C', NOITE);

    expect(tabTotals(desfeito.state, ana.id).totalCents).toBe(antes);
  });
});

describe('cardápio rápido', () => {
  it('as categorias e os itens mais vendidos vêm primeiro', () => {
    const menu = menuByCategory(demo().catalog);
    expect(menu[0].category).toBe('Cervejas'); // 40 + 28 + 22 usos
    expect(menu[0].items.map((i) => i.name)).toEqual([
      'Chopp',
      'Cerveja long neck',
      'Cerveja 600ml',
    ]);
  });

  it('não mostra itens arquivados nem juntados a outro', () => {
    const state = demo();
    const chopp = itemByName(state, 'Chopp');
    const arquivado = state.catalog.map((c) =>
      c.id === chopp.id ? { ...c, status: 'archived' as const } : c,
    );
    const nomes = menuByCategory(arquivado).flatMap((m) => m.items.map((i) => i.name));
    expect(nomes).not.toContain('Chopp');
  });
});

describe('venda sugestiva: "costuma sair junto"', () => {
  it('quem pediu caipirinha costuma pedir isca de frango', () => {
    const state = demo();
    const carla = tabByName(state, 'Carla'); // só tem caipirinha
    const [primeira] = suggestPairings(state, carla.id);

    expect(primeira.item.name).toBe('Isca de frango');
    expect(primeira.because).toBe('Caipirinha');
    expect(primeira.tabs).toBeGreaterThanOrEqual(2);
  });

  it('não sugere o que a comanda já tem', () => {
    const state = demo();
    const ana = tabByName(state, 'Ana'); // chopp + batata
    const nomes = suggestPairings(state, ana.id, 10).map((p) => p.item.name);
    expect(nomes).not.toContain('Chopp');
    expect(nomes).not.toContain('Porção de batata frita');
  });

  it('comanda vazia não recebe sugestão (o cardápio já mostra os mais vendidos)', () => {
    const state = demo();
    const nova = {
      ...state,
      tabs: [...state.tabs, { ...tabByName(state, 'Carla'), id: 'tab-vazia', code: 9 }],
    };
    expect(suggestPairings(nova, 'tab-vazia')).toEqual([]);
  });

  it('ignora comandas anuladas ao contar os pares', () => {
    const state = demo();
    const carla = tabByName(state, 'Carla');
    const gina = tabByName(state, 'Gina');
    const iara = tabByName(state, 'Iara');
    const diego = tabByName(state, 'Diego');
    const fabio = tabByName(state, 'Fábio');

    let anulado = state;
    for (const t of [gina, iara, diego, fabio]) anulado = voidTab(anulado, t.id, NOITE).state;
    expect(suggestPairings(anulado, carla.id)).toEqual([]);
  });
});

describe('relatório de vendas do gerente', () => {
  it('fecha as contas de ontem: comandas, itens, faturamento e ticket médio', () => {
    const r = salesReport(demo(), ONTEM);
    expect(r.tabs).toBe(6);
    expect(r.units).toBe(31);
    expect(r.revenueCents).toBe(64200);
    expect(r.avgTicketCents).toBe(10700);
    expect(r.unitsPerTab).toBeCloseTo(31 / 6);
    expect(r.unpricedUnits).toBe(0);
  });

  it('lista os mais vendidos por unidades', () => {
    const [primeiro, segundo] = salesReport(demo(), ONTEM).top;
    expect(primeiro).toMatchObject({ name: 'Chopp', units: 7 });
    expect(segundo).toMatchObject({ name: 'Caipirinha', units: 5 });
  });

  it('comanda anulada não entra no relatório', () => {
    const state = demo();
    const ana = tabByName(state, 'Ana');
    const antes = salesReport(state, HOJE);
    const depois = salesReport(voidTab(state, ana.id, NOITE).state, HOJE);

    expect(depois.tabs).toBe(antes.tabs - 1);
    expect(depois.revenueCents).toBe(antes.revenueCents - 9200);
  });

  it('avisa quais itens foram vendidos sem preço', () => {
    const state = demo();
    const carla = tabByName(state, 'Carla');
    const r = addItem(
      state,
      { tabId: carla.id, name: 'Caldinho de feijão', qty: 3, by: 'Carlos' },
      NOITE,
    );

    const hoje = salesReport(r.state, HOJE);
    expect(hoje.unpricedUnits).toBe(3);
    expect(hoje.unpricedItems).toEqual([
      expect.objectContaining({ name: 'Caldinho de feijão', units: 3 }),
    ]);
  });

  it('dia sem comandas devolve zeros, sem dividir por zero', () => {
    const r = salesReport(demo(), '2020-01-01');
    expect(r).toMatchObject({
      tabs: 0,
      units: 0,
      revenueCents: 0,
      avgTicketCents: 0,
      unitsPerTab: 0,
    });
  });
});
