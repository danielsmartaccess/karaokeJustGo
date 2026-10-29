import { describe, expect, it } from 'vitest';
import { createDemoState } from '@/comandas/demoData';
import {
  addItem,
  confirmPhone,
  findTabs,
  mergeCatalogItem,
  normalizeName,
  openTab,
  parseQuickEntry,
  reverseItem,
  searchCatalog,
  serviceDay,
  summarizeItems,
  voidTab,
  MAX_TABS_PER_DAY,
} from '@/comandas/rules';
import type { ComandaState } from '@/comandas/types';

/**
 * Regras das comandas (docs/COMANDAS.md): dia de serviço, uma comanda por
 * celular por dia, livro-razão de itens com estorno, busca do garçom e
 * curadoria do catálogo. Funções puras: sem React, sem rede.
 */

// Sexta, 30/10/2026, 22:00 no horário local.
const NOITE = new Date(2026, 9, 30, 22, 0, 0).getTime();
const empty = (): ComandaState => ({ tabs: [], items: [], catalog: [], staff: [] });
const demo = () => createDemoState(NOITE);

function abrir(state: ComandaState, name: string, phone: string | undefined, now = NOITE) {
  const r = openTab(state, { name, phone, openedBy: phone ? 'cliente' : 'garcom' }, now);
  if (!r.result.ok) throw new Error(`falhou: ${r.result.reason}`);
  return { state: r.state, tab: r.result.tab };
}

describe('dia de serviço', () => {
  it('a noite vai até as 6h: 01h de sábado ainda é o dia de sexta', () => {
    expect(serviceDay(new Date(2026, 9, 31, 1, 0))).toBe('2026-10-30');
    expect(serviceDay(new Date(2026, 9, 31, 5, 59))).toBe('2026-10-30');
  });

  it('às 6h começa o dia seguinte', () => {
    expect(serviceDay(new Date(2026, 9, 31, 6, 0))).toBe('2026-10-31');
  });
});

describe('digitação rápida', () => {
  it('"3 chopp" lança 3 de uma vez', () => {
    expect(parseQuickEntry('3 chopp')).toEqual({ qty: 3, term: 'chopp' });
    expect(parseQuickEntry('2x caipirinha')).toEqual({ qty: 2, term: 'caipirinha' });
    expect(parseQuickEntry('4 × gin tônica')).toEqual({ qty: 4, term: 'gin tônica' });
  });

  it('sem número, a quantidade é 1', () => {
    expect(parseQuickEntry('chopp')).toEqual({ qty: 1, term: 'chopp' });
  });

  it('número colado ou grande demais não vira quantidade', () => {
    expect(parseQuickEntry('7up')).toEqual({ qty: 1, term: '7up' });
    expect(parseQuickEntry('51 ice')).toEqual({ qty: 1, term: '51 ice' });
    expect(parseQuickEntry('51')).toEqual({ qty: 1, term: '51' });
  });
});

describe('autocomplete do catálogo', () => {
  const { catalog } = demo();

  it('é tolerante a acento e abreviação', () => {
    expect(searchCatalog(catalog, 'chop')[0].name).toBe('Chopp');
    expect(searchCatalog(catalog, 'gin tonica')[0].name).toBe('Gin tônica');
    expect(searchCatalog(catalog, 'PORCAO batata')[0].name).toBe('Porção de batata frita');
  });

  it('o que começa com o texto vem antes do que só o contém', () => {
    const nomes = searchCatalog(catalog, 'ca').map((c) => c.name);
    expect(nomes.indexOf('Caipirinha')).toBeLessThan(nomes.indexOf('Dose de cachaça'));
  });

  it('sem texto, devolve os mais usados', () => {
    expect(searchCatalog(catalog, '')[0].name).toBe('Chopp');
  });

  it('não sugere itens arquivados', () => {
    const arquivado = catalog.map((c) =>
      c.name === 'Chopp' ? { ...c, status: 'archived' as const } : c,
    );
    expect(searchCatalog(arquivado, 'chopp')).toHaveLength(0);
  });
});

describe('abrir a comanda', () => {
  it('numera as comandas em sequência dentro do dia', () => {
    const a = abrir(empty(), 'Ana', '51 99999-0101');
    const b = abrir(a.state, 'Bruno', '51 99999-0202');
    expect([a.tab.code, b.tab.code]).toEqual([1, 2]);
  });

  it('recusa o mesmo celular duas vezes no dia e não devolve a comanda existente', () => {
    const a = abrir(empty(), 'Ana', '51 99999-0101');
    const r = openTab(
      a.state,
      { name: 'Outra pessoa', phone: '(51) 99999-0101', openedBy: 'cliente' },
      NOITE,
    );

    expect(r.result).toEqual({ ok: false, reason: 'phone-already-open' });
    expect(r.state).toBe(a.state);
  });

  it('o mesmo celular pode abrir outra comanda no dia seguinte', () => {
    const a = abrir(empty(), 'Ana', '51 99999-0101', NOITE);
    const amanha = NOITE + 24 * 60 * 60 * 1000;
    const b = abrir(a.state, 'Ana', '51 99999-0101', amanha);

    expect(b.tab.code).toBe(1);
    expect(b.tab.serviceDay).not.toBe(a.tab.serviceDay);
  });

  it('comanda anulada libera o celular', () => {
    const a = abrir(empty(), 'Ana', '51 99999-0101');
    const anulada = voidTab(a.state, a.tab.id, NOITE);
    expect(abrir(anulada.state, 'Ana', '51 99999-0101').tab.code).toBe(2);
  });

  it('o cliente precisa de um celular válido; o garçom pode abrir sem celular', () => {
    expect(openTab(empty(), { name: 'Ana', openedBy: 'cliente' }, NOITE).result).toEqual({
      ok: false,
      reason: 'invalid-phone',
    });
    expect(
      openTab(empty(), { name: 'Ana', phone: '123', openedBy: 'cliente' }, NOITE).result,
    ).toEqual({
      ok: false,
      reason: 'invalid-phone',
    });
    const semCelular = abrir(empty(), 'Carla', undefined);
    expect(semCelular.tab.phoneStatus).toBe('sem_celular');
  });

  it('recusa nome vazio', () => {
    expect(
      openTab(empty(), { name: '   ', phone: '51 99999-0101', openedBy: 'cliente' }, NOITE).result,
    ).toEqual({
      ok: false,
      reason: 'invalid-name',
    });
  });

  it('respeita o teto diário de comandas', () => {
    let state = empty();
    for (let i = 0; i < MAX_TABS_PER_DAY; i++) {
      state = abrir(state, `Cliente ${i}`, undefined).state;
    }
    expect(openTab(state, { name: 'Mais um', openedBy: 'garcom' }, NOITE).result).toEqual({
      ok: false,
      reason: 'daily-cap',
    });
  });

  it('nasce "informado" e o garçom confirma', () => {
    const a = abrir(empty(), 'Ana', '51 99999-0101');
    expect(a.tab.phoneStatus).toBe('informado');
    expect(a.tab.phoneLast4).toBe('0101');

    const confirmada = confirmPhone(a.state, a.tab.id);
    expect(confirmada.state.tabs[0].phoneStatus).toBe('confirmado');
  });
});

describe('busca do garçom', () => {
  const state = demo();
  const hoje = serviceDay(NOITE);

  it('acha por número, por 4 últimos dígitos e por nome', () => {
    expect(findTabs(state, '2', hoje).map((t) => t.customerName)).toEqual(['Bruno Lima']);
    expect(findTabs(state, '0101', hoje).map((t) => t.customerName)).toEqual(['Ana Souza']);
    expect(findTabs(state, 'ana', hoje).map((t) => t.customerName)).toEqual(['Ana Souza']);
    expect(findTabs(state, 'CARLA', hoje)).toHaveLength(1);
  });

  it('nunca devolve comanda de outro dia, mesmo que o final do celular case', () => {
    expect(findTabs(state, '0303', hoje)).toHaveLength(0); // Diego é de ontem
  });

  it('não devolve comanda anulada', () => {
    const ana = state.tabs.find((t) => t.customerName === 'Ana Souza')!;
    const anulada = voidTab(state, ana.id, NOITE).state;
    expect(findTabs(anulada, '0101', hoje)).toHaveLength(0);
  });

  it('limita a 10 resultados', () => {
    let many = empty();
    for (let i = 0; i < 15; i++) many = abrir(many, `Ana ${i}`, undefined).state;
    expect(findTabs(many, 'ana', hoje)).toHaveLength(10);
  });
});

describe('itens da comanda', () => {
  const base = () => {
    const state = demo();
    const ana = state.tabs.find((t) => t.customerName === 'Ana Souza')!;
    return { state, ana };
  };

  it('agrupa o consumo ("5× Chopp") somando os lançamentos', () => {
    const { state, ana } = base();
    const chopp = summarizeItems(state, ana.id).find((l) => l.name === 'Chopp');
    expect(chopp?.qty).toBe(5); // 3 + 2 na demonstração
  });

  it('item digitado novo vira sugestão e já fica disponível', () => {
    const { state, ana } = base();
    const r = addItem(
      state,
      { tabId: ana.id, name: '  cervja   gelada ', qty: 2, by: 'Carlos' },
      NOITE,
    );
    if (!r.result.ok) throw new Error('falhou');

    expect(r.result.created).toBe(true);
    const nova = r.state.catalog.find((c) => c.normalized === 'cervja gelada')!;
    expect(nova.status).toBe('suggested');
    expect(searchCatalog(r.state.catalog, 'cervja')[0].id).toBe(nova.id);
  });

  it('digitar um item que já existe reaproveita o do catálogo, sem duplicar', () => {
    const { state, ana } = base();
    const antes = state.catalog.length;
    const r = addItem(state, { tabId: ana.id, name: 'CHOPP', qty: 1, by: 'Carlos' }, NOITE);

    expect(r.result).toMatchObject({ ok: true, created: false });
    expect(r.state.catalog).toHaveLength(antes);
  });

  it('lançar atualiza uso e recência do item (ranking do autocomplete)', () => {
    const { state, ana } = base();
    const chopp = state.catalog.find((c) => c.name === 'Chopp')!;
    const r = addItem(
      state,
      { tabId: ana.id, catalogItemId: chopp.id, qty: 3, by: 'Carlos' },
      NOITE,
    );

    const depois = r.state.catalog.find((c) => c.id === chopp.id)!;
    expect(depois.useCount).toBe(chopp.useCount + 3);
    expect(depois.lastUsedAt).toBe(NOITE);
  });

  it('só aceita itens em comanda de hoje: depois do corte, a comanda se fecha', () => {
    const { state, ana } = base();
    const chopp = state.catalog.find((c) => c.name === 'Chopp')!;
    const manha = new Date(2026, 9, 31, 7, 0).getTime(); // já é outro dia de serviço

    expect(
      addItem(state, { tabId: ana.id, catalogItemId: chopp.id, qty: 1, by: 'C' }, manha).result,
    ).toEqual({
      ok: false,
      reason: 'tab-not-open-today',
    });
  });

  it('não lança em comanda anulada, com quantidade inválida ou sem nome', () => {
    const { state, ana } = base();
    const chopp = state.catalog.find((c) => c.name === 'Chopp')!;
    const anulada = voidTab(state, ana.id, NOITE).state;

    expect(
      addItem(anulada, { tabId: ana.id, catalogItemId: chopp.id, qty: 1, by: 'C' }, NOITE).result,
    ).toMatchObject({
      reason: 'tab-not-open-today',
    });
    expect(
      addItem(state, { tabId: ana.id, catalogItemId: chopp.id, qty: 0, by: 'C' }, NOITE).result,
    ).toMatchObject({
      reason: 'invalid-qty',
    });
    expect(
      addItem(state, { tabId: ana.id, name: '  ', qty: 1, by: 'C' }, NOITE).result,
    ).toMatchObject({
      reason: 'empty-name',
    });
  });

  it('estorno é uma linha negativa: o total cai e a linha original continua no histórico', () => {
    const { state, ana } = base();
    const original = state.items.find(
      (i) => i.tabId === ana.id && i.nameSnapshot === 'Chopp' && i.qty === 3,
    )!;
    const r = reverseItem(state, original.id, 'Carlos', NOITE);

    expect(r.result.ok).toBe(true);
    expect(r.state.items).toHaveLength(state.items.length + 1);
    expect(r.state.items.find((i) => i.id === original.id)).toEqual(original); // nada foi alterado
    expect(summarizeItems(r.state, ana.id).find((l) => l.name === 'Chopp')?.qty).toBe(2);
  });

  it('não estorna a mesma linha duas vezes, nem um estorno', () => {
    const { state, ana } = base();
    const original = state.items.find((i) => i.tabId === ana.id && i.qty === 3)!;
    const uma = reverseItem(state, original.id, 'Carlos', NOITE);
    expect(reverseItem(uma.state, original.id, 'Carlos', NOITE).result.ok).toBe(false);

    const linhaDeEstorno = uma.state.items.find((i) => i.reversesItemId === original.id)!;
    expect(reverseItem(uma.state, linhaDeEstorno.id, 'Carlos', NOITE).result.ok).toBe(false);
  });

  it('item totalmente estornado some do consumo', () => {
    const { state, ana } = base();
    const batata = state.items.find(
      (i) => i.tabId === ana.id && i.nameSnapshot.startsWith('Porção'),
    )!;
    const r = reverseItem(state, batata.id, 'Carlos', NOITE);
    expect(summarizeItems(r.state, ana.id).some((l) => l.name.startsWith('Porção'))).toBe(false);
  });
});

describe('curadoria do catálogo', () => {
  it('juntar uma duplicata soma os totais no item de destino', () => {
    const state = demo();
    const ana = state.tabs.find((t) => t.customerName === 'Ana Souza')!;
    const r = addItem(state, { tabId: ana.id, name: 'Chop', qty: 2, by: 'Carlos' }, NOITE);
    if (!r.result.ok) throw new Error('falhou');
    const duplicata = r.state.catalog.find((c) => c.normalized === 'chop')!;
    const chopp = r.state.catalog.find((c) => c.name === 'Chopp')!;

    const juntado = mergeCatalogItem(r.state, duplicata.id, chopp.id);

    expect(juntado.catalog.find((c) => c.id === duplicata.id)).toMatchObject({
      status: 'archived',
      mergedInto: chopp.id,
    });
    // 3 + 2 (demonstração) + 2 (duplicata), tudo em "Chopp"
    expect(summarizeItems(juntado, ana.id).find((l) => l.name === 'Chopp')?.qty).toBe(7);
    // e a duplicata deixa de aparecer no autocomplete
    expect(searchCatalog(juntado.catalog, 'chop').every((c) => c.id !== duplicata.id)).toBe(true);
  });

  it('não junta um item consigo mesmo', () => {
    const state = demo();
    const chopp = state.catalog.find((c) => c.name === 'Chopp')!;
    expect(mergeCatalogItem(state, chopp.id, chopp.id)).toBe(state);
  });

  it('renomear o catálogo não altera o nome gravado nas comandas antigas', () => {
    const state = demo();
    const chopp = state.catalog.find((c) => c.name === 'Chopp')!;
    const item = state.items.find((i) => i.catalogItemId === chopp.id)!;
    expect(item.nameSnapshot).toBe('Chopp');
  });
});

describe('texto', () => {
  it('normaliza acento, caixa e espaços', () => {
    expect(normalizeName('  Gin   TÔNICA ')).toBe('gin tonica');
  });
});
