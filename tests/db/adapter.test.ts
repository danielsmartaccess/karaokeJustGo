/* eslint-disable @typescript-eslint/no-explicit-any -- fixture de teste */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSupabaseBackend, type Rpc } from '@/comandas/backend/supabaseBackend';
import { ComandaError, type ComandaBackend } from '@/comandas/backend/types';
import { ANON, as, createDb, seedBasics, WHO, type Who } from './harness';

/**
 * O adaptador do Supabase contra o SQL de verdade (Postgres local): prova que os
 * nomes dos parâmetros, os códigos de erro e a conversão dos dados batem com o
 * banco, sem precisar de Supabase. `who` troca de papel entre as chamadas, como
 * trocaria o login no app.
 */

let db: PGlite;
let who: Who = ANON;

/** `rpc` que chama a função do banco com argumentos NOMEADOS (como o PostgREST faz). */
const rpc: Rpc = async (fn, args = {}) => {
  const names = Object.keys(args);
  const call = names.map((n, i) => `${n} => $${i + 1}`).join(', ');
  try {
    const rows = await as<{ r: unknown }>(
      db,
      who,
      `select public.${fn}(${call}) as r`,
      names.map((n) => args[n]),
    );
    return { data: rows[0].r, error: null };
  } catch (e) {
    return { data: null, error: { message: (e as Error).message } };
  }
};

let backend: ComandaBackend;
const as_ = (w: Who) => {
  who = w;
  return backend;
};
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ComandaError ? e.code : `(erro estranho: ${String(e)})`;
  }
  return '(não falhou)';
};

beforeAll(async () => {
  db = await createDb();
  backend = createSupabaseBackend(rpc);
}, 60000);
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec('begin');
  await seedBasics(db);
});
afterEach(async () => {
  who = ANON;
  await db.exec('rollback');
});

describe('adaptador do Supabase x SQL real', () => {
  it('fluxo completo: cliente abre, garçom lança, gerente fecha, cliente vê a conta final', async () => {
    const opened = await as_(ANON).openTab({
      name: 'Ana Souza',
      phone: '51 99999-0909',
      table: '4',
    });
    expect(opened).toMatchObject({ code: 1 });
    expect(opened.secret).toHaveLength(64);

    const found = await as_(WHO.waiter).findTabs('0909');
    expect(found[0]).toMatchObject({
      code: 1,
      customerName: 'Ana Souza',
      phoneLast4: '0909',
      phoneStatus: 'informado',
    });
    expect(await backend.confirmPhone(opened.tabId)).toBe(true);

    const menu = await backend.menu();
    const chopp = menu.find((m) => m.name === 'Chopp')!;
    expect(chopp).toMatchObject({ category: 'Cervejas', priceCents: 1200, status: 'approved' });
    await backend.addItem({ tabId: opened.tabId, catalogItemId: chopp.id, qty: 3 });
    const typed = await backend.addItem({ tabId: opened.tabId, name: 'Pastel', qty: 2 });
    expect(typed).toMatchObject({ name: 'Pastel', created: true });

    expect(await backend.removeOne(opened.tabId, chopp.id)).toBe(true);
    const detail = await backend.getTab(opened.tabId);
    expect(detail).toMatchObject({
      units: 4,
      totalCents: 2400,
      unpricedUnits: 2,
      status: 'aberta',
    });
    expect(detail.phone).toBeUndefined(); // garçom não vê o número inteiro
    expect(detail.ledger.some((l) => l.qty < 0 && l.reversesItemId)).toBe(true);

    // Cliente pede a conta; gerente vê na fila e fecha.
    await as_(ANON).requestBill(opened.tabId, opened.secret);
    const fila = await as_(WHO.manager).pendingBills();
    expect(fila[0]).toMatchObject({ code: 1, status: 'conta_pedida', phoneStatus: 'confirmado' });

    expect(await codeOf(backend.closeTab(opened.tabId, 'pix'))).toBe('unpriced-items');
    const price = (await backend.catalogList()).find((c) => c.name === 'Pastel')!;
    expect(await backend.setPrice(price.id, 1000)).toBe(true);
    expect(await backend.closeTab(opened.tabId, 'pix')).toEqual({
      totalCents: 4400,
      unpricedUnits: 0,
    });

    const mine = await as_(ANON).getMyTab(opened.tabId, opened.secret);
    expect(mine).toMatchObject({ status: 'fechada', closedTotalCents: 4400, code: 1 });
    expect(mine.lines.map((l) => l.name)).toEqual(['Chopp', 'Pastel']);
  });

  it('traduz os erros do banco em códigos do contrato', async () => {
    await as_(ANON).openTab({ name: 'Ana', phone: '51 99999-0101' });
    expect(await codeOf(backend.openTab({ name: 'Outra', phone: '(51) 99999-0101' }))).toBe(
      'phone-already-open',
    );
    expect(await codeOf(backend.openTab({ name: '', phone: '51 99999-0202' }))).toBe(
      'invalid-name',
    );
    expect(await codeOf(backend.openTab({ name: 'Bia', phone: '123' }))).toBe('invalid-phone');
    expect(await codeOf(backend.getMyTab('00000000-0000-0000-0000-000000000099', 'x'))).toBe(
      'not-found',
    );

    // Sem permissão: anon chamando função da equipe, garçom chamando a do gerente.
    expect(await codeOf(as_(ANON).menu())).toBe('forbidden');
    expect(await codeOf(as_(WHO.waiter).salesReport())).toBe('forbidden');
    expect(await codeOf(as_(WHO.pending).menu())).toBe('forbidden');
  });

  it('cadastro e aprovação da equipe', async () => {
    expect(await as_(WHO.visitor).whoami()).toEqual({ registered: false });
    expect(await backend.registerStaff('Visita')).toMatchObject({
      registered: true,
      role: 'garcom',
      active: false,
    });

    await as_(WHO.manager).setStaffActive(WHO.visitor.uid!, true);
    expect(await as_(WHO.visitor).whoami()).toMatchObject({ active: true, name: 'Visita' });

    const equipe = await as_(WHO.manager).staffList();
    expect(equipe.map((s) => s.name).sort()).toEqual(['Carlos', 'João', 'Marina', 'Visita']);
    expect(equipe.find((s) => s.name === 'Marina')).toMatchObject({
      role: 'gerente',
      email: 'marina@exemplo.test',
    });
    expect(await codeOf(backend.setStaffActive(WHO.manager.uid!, false))).toBe(
      'cannot-deactivate-self',
    );
    await backend.setStaffRole(WHO.visitor.uid!, 'gerente');
  });

  it('catálogo: criar, renomear, aprovar, juntar, arquivar e erros', async () => {
    expect(await as_(WHO.manager).addCatalogItem('Tábua de frios', 'Porções', 5800)).toBe(true);
    expect(await backend.addCatalogItem('tabua DE frios')).toBe(false); // já existe

    expect(await backend.addCatalogItem('Caldinho')).toBe(true);
    const list = await backend.catalogList();
    const caldinho = list.find((c) => c.name === 'Caldinho')!;
    expect(caldinho).toMatchObject({ category: 'Outros', status: 'approved' });
    expect(await backend.renameItem(caldinho.id, 'Caldinho de feijão')).toBe(true);
    expect(await codeOf(backend.renameItem(caldinho.id, 'chopp'))).toBe('name-taken');
    expect(await codeOf(backend.setPrice(caldinho.id, -5))).toBe('invalid-price');

    const chopp = list.find((c) => c.name === 'Chopp')!;
    expect(await backend.mergeItem(caldinho.id, chopp.id)).toBe(true);
    expect((await backend.catalogList()).find((c) => c.id === caldinho.id)).toMatchObject({
      mergedInto: chopp.id,
      status: 'archived',
    });
    expect(await backend.archiveItem(chopp.id)).toBe(true);
    expect(await backend.approveItem(chopp.id)).toBe(true);
  });

  it('relatório, lista do dia, venda sugestiva, estorno e recuperação de acesso', async () => {
    const a = await as_(ANON).openTab({ name: 'Ana', phone: '51 99999-0101' });
    const caip = (await as_(WHO.waiter).menu()).find((m) => m.name === 'Caipirinha')!;
    const added = await backend.addItem({ tabId: a.tabId, catalogItemId: caip.id, qty: 2 });
    expect(await backend.reverseItem(added.itemId, 1)).toBe(true);
    expect(await backend.reverseItem(added.itemId, 5)).toBe(false);
    expect(await backend.suggestPairings(a.tabId, 3)).toEqual([]); // sem histórico ainda

    const re = await backend.reissueSecret(a.tabId);
    expect(await codeOf(as_(ANON).getMyTab(a.tabId, a.secret))).toBe('not-found');
    expect((await backend.getMyTab(a.tabId, re.secret)).code).toBe(1);

    await as_(WHO.waiter).requestBillByStaff(a.tabId);
    const sem = await backend.openTabByStaff('Carla', 'fundo');
    expect(sem.code).toBe(2);

    const list = await as_(WHO.manager).listTabs();
    expect(list).toHaveLength(2);
    expect(list.find((t) => t.code === 1)).toMatchObject({
      phone: '5551999990101',
      status: 'conta_pedida',
      totalCents: 2200,
    });

    const rep = await backend.salesReport();
    expect(rep).toMatchObject({ tabs: 2, units: 1, revenueCents: 2200, avgTicketCents: 2200 });
    expect(rep.top[0]).toMatchObject({ name: 'Caipirinha', units: 1, revenueCents: 2200 });

    await backend.voidTab(sem.tabId);
    await backend.closeTab(a.tabId, 'dinheiro');
    await backend.reopenTab(a.tabId);
    expect((await backend.getTab(a.tabId)).status).toBe('aberta');
    expect(await codeOf(backend.reopenTab(a.tabId))).toBe('cannot-reopen');
  });
});
