import { describe, expect, it } from 'vitest';
import { createDemoState } from '@/comandas/demoData';
import {
  addItem,
  closeTab,
  removeOne,
  reopenTab,
  requestBill,
  reverseItem,
  serviceDay,
  tabStatus,
  tabTotals,
} from '@/comandas/rules';

/** Conta pedida e fechamento no modo demonstração (espelha as funções do banco). */

const NOITE = new Date(2026, 9, 30, 22, 0, 0).getTime();
const demo = () => createDemoState(NOITE);
const ana = (state: ReturnType<typeof demo>) =>
  state.tabs.find((t) => t.customerName.startsWith('Ana'))!;
const item = (state: ReturnType<typeof demo>, name: string) =>
  state.catalog.find((c) => c.name === name)!;

describe('conta pedida', () => {
  it('pedir a conta muda o estado e é idempotente', () => {
    const state = demo();
    const r = requestBill(state, ana(state).id, NOITE);
    expect(r.result).toEqual({ ok: true });
    expect(tabStatus(r.state.tabs.find((t) => t.id === ana(state).id)!)).toBe('conta_pedida');

    const again = requestBill(r.state, ana(state).id, NOITE + 60_000);
    expect(again.state).toBe(r.state);
  });

  it('com a conta pedida ainda aceita itens', () => {
    const state = requestBill(demo(), ana(demo()).id, NOITE).state;
    const r = addItem(
      state,
      { tabId: ana(state).id, catalogItemId: item(state, 'Chopp').id, qty: 1, by: 'C' },
      NOITE,
    );
    expect(r.result.ok).toBe(true);
  });
});

describe('fechamento', () => {
  it('congela o total e registra o pagamento', () => {
    const state = demo();
    const r = closeTab(state, ana(state).id, 'cartao', false, NOITE);
    expect(r.result).toEqual({ ok: true, totalCents: 9200, unpricedUnits: 0 });
    const closed = r.state.tabs.find((t) => t.id === ana(state).id)!;
    expect(closed).toMatchObject({
      status: 'fechada',
      closedTotalCents: 9200,
      paymentMethod: 'cartao',
    });
  });

  it('recusa item sem preço, a menos que o gerente aceite', () => {
    const state = demo();
    const comSemPreco = addItem(
      state,
      { tabId: ana(state).id, name: 'Petisco', qty: 2, by: 'C' },
      NOITE,
    ).state;
    const recusa = closeTab(comSemPreco, ana(state).id, 'pix', false, NOITE);
    expect(recusa.result).toEqual({ ok: false, reason: 'unpriced-items' });
    expect(recusa.state).toBe(comSemPreco);

    const aceita = closeTab(comSemPreco, ana(state).id, 'pix', true, NOITE);
    expect(aceita.result).toMatchObject({ ok: true, totalCents: 9200, unpricedUnits: 2 });
  });

  it('depois de fechada: não lança, não estorna, não fecha de novo, não pede conta', () => {
    const state = demo();
    const closed = closeTab(state, ana(state).id, 'dinheiro', false, NOITE).state;
    const id = ana(state).id;

    expect(
      addItem(closed, { tabId: id, catalogItemId: item(state, 'Chopp').id, qty: 1, by: 'C' }, NOITE)
        .result,
    ).toMatchObject({ ok: false });
    const linha = closed.items.find((i) => i.tabId === id && i.qty > 0)!;
    expect(reverseItem(closed, linha.id, 'C', NOITE).result).toEqual({ ok: false });
    expect(closeTab(closed, id, 'pix', false, NOITE).result).toEqual({
      ok: false,
      reason: 'tab-closed',
    });
    expect(requestBill(closed, id, NOITE).result).toEqual({ ok: false, reason: 'tab-closed' });
    expect(removeOne(closed, id, item(state, 'Chopp').id, 'C', NOITE).result).toEqual({
      ok: false,
    });
  });

  it('o total congelado não muda quando o preço muda depois', () => {
    const state = demo();
    const closed = closeTab(state, ana(state).id, 'pix', false, NOITE).state;
    const repriced = {
      ...closed,
      catalog: closed.catalog.map((c) => (c.name === 'Chopp' ? { ...c, priceCents: 9999 } : c)),
    };
    expect(repriced.tabs.find((t) => t.id === ana(state).id)!.closedTotalCents).toBe(9200);
  });

  it('reabre só no mesmo dia e descarta o total congelado', () => {
    const state = demo();
    const closed = closeTab(state, ana(state).id, 'pix', false, NOITE).state;
    const r = reopenTab(closed, ana(state).id, NOITE);
    expect(r.result).toEqual({ ok: true });
    expect(r.state.tabs.find((t) => t.id === ana(state).id)).toMatchObject({
      status: 'aberta',
      closedTotalCents: undefined,
      paymentMethod: undefined,
    });
    expect(tabTotals(r.state, ana(state).id).totalCents).toBe(9200);

    expect(reopenTab(closed, ana(state).id, NOITE + 24 * 3600 * 1000).result).toEqual({
      ok: false,
    });
    expect(serviceDay(NOITE)).toBeTruthy();
  });

  it('comanda inexistente ou aberta não reabre nem fecha duas vezes', () => {
    const state = demo();
    expect(reopenTab(state, ana(state).id, NOITE).result).toEqual({ ok: false });
    expect(closeTab(state, 'nada', 'pix', false, NOITE).result).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });
});
