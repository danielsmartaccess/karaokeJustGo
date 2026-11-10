import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoBackend, type DemoBackend } from '@/comandas/backend/demoBackend';
import { ComandaError } from '@/comandas/backend/types';

/** A fonte de demonstração segue o mesmo contrato e os mesmos códigos de erro do banco. */

const CARLOS = 'staff-carlos'; // garçom ativo
const MARINA = 'staff-marina'; // gerente ativo
const JOAO = 'staff-joao'; // garçom pendente

let backend: DemoBackend;

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ComandaError ? e.code : `(erro estranho: ${String(e)})`;
  }
  return '(não falhou)';
};
const as = (staffId: string | null) => {
  backend.demo.signInAs(staffId);
  return backend;
};

beforeEach(() => {
  localStorage.clear();
  backend = createDemoBackend();
});

describe('backend de demonstração', () => {
  it('fluxo completo: cliente abre, garçom lança, gerente fecha, cliente vê a conta final', async () => {
    const opened = await backend.openTab({ name: 'Teste Silva', phone: '51 99999-0909' });

    await as(CARLOS).findTabs('0909');
    const chopp = (await backend.menu()).find((m) => m.name === 'Chopp')!;
    await backend.addItem({ tabId: opened.tabId, catalogItemId: chopp.id, qty: 3 });
    await backend.addItem({ tabId: opened.tabId, name: 'Petisco novo', qty: 1 });
    expect(await backend.removeOne(opened.tabId, chopp.id)).toBe(true);

    const detail = await backend.getTab(opened.tabId);
    expect(detail).toMatchObject({
      units: 3,
      totalCents: 2400,
      unpricedUnits: 1,
      status: 'aberta',
    });
    expect(detail.phone).toBeUndefined(); // garçom vê só o final

    await backend.requestBill(opened.tabId, opened.secret);
    expect((await as(MARINA).pendingBills())[0]).toMatchObject({ status: 'conta_pedida' });
    expect(await codeOf(backend.closeTab(opened.tabId, 'pix'))).toBe('unpriced-items');
    expect(await backend.closeTab(opened.tabId, 'pix', true)).toEqual({
      totalCents: 2400,
      unpricedUnits: 1,
    });

    const mine = await backend.getMyTab(opened.tabId, opened.secret);
    expect(mine).toMatchObject({ status: 'fechada', closedTotalCents: 2400 });
    expect((await backend.getTab(opened.tabId)).phone).toBe('5551999990909'); // gerente vê inteiro
  });

  it('os mesmos códigos de erro do banco', async () => {
    expect(await codeOf(backend.openTab({ name: 'Outra', phone: '51 99999-0101' }))).toBe(
      'phone-already-open', // celular da Ana, na demonstração
    );
    expect(await codeOf(backend.openTab({ name: '', phone: '51 99999-0202' }))).toBe(
      'invalid-name',
    );
    expect(await codeOf(backend.openTab({ name: 'Bia', phone: '123' }))).toBe('invalid-phone');
    expect(await codeOf(backend.getMyTab('nada', 'nada'))).toBe('not-found');
  });

  it('permissões: sem login, pendente e garçom no que é do gerente', async () => {
    expect(await codeOf(as(null).menu())).toBe('forbidden');
    expect(await codeOf(as(JOAO).menu())).toBe('forbidden');
    expect(await codeOf(as(CARLOS).salesReport())).toBe('forbidden');
    expect(await codeOf(backend.listTabs())).toBe('forbidden');
    expect(await codeOf(backend.setPrice('x', 100))).toBe('forbidden');
  });

  it('whoami reflete quem entrou', async () => {
    expect(await as(null).whoami()).toEqual({ registered: false });
    expect(await as(JOAO).whoami()).toMatchObject({ active: false, role: 'garcom' });
    expect(await as(MARINA).whoami()).toMatchObject({
      active: true,
      role: 'gerente',
      name: 'Marina',
    });
  });

  it('a equipe: ativar, promover e as travas contra si mesmo', async () => {
    await as(MARINA).setStaffActive(JOAO, true);
    expect(await as(JOAO).whoami()).toMatchObject({ active: true });
    expect(await codeOf(as(MARINA).setStaffActive(MARINA, false))).toBe('cannot-deactivate-self');
    expect(await codeOf(backend.setStaffRole(MARINA, 'garcom'))).toBe('cannot-change-own-role');
    await backend.setStaffRole(JOAO, 'gerente');
    expect((await backend.staffList()).find((s) => s.userId === JOAO)?.role).toBe('gerente');
  });

  it('catálogo: preço, nome repetido, juntar e arquivar', async () => {
    await as(MARINA);
    const list = await backend.catalogList();
    const chopp = list.find((c) => c.name === 'Chopp')!;
    expect(await backend.setPrice(chopp.id, 1500)).toBe(true);
    expect(await codeOf(backend.setPrice(chopp.id, -1))).toBe('invalid-price');
    expect(await backend.setPrice('nada', 100)).toBe(false);
    expect(await codeOf(backend.renameItem(chopp.id, 'cerveja long neck'))).toBe('name-taken');
    expect(await backend.addCatalogItem('Torresmo', 'Porções', 3000)).toBe(true);
    expect(await backend.addCatalogItem('TORRESMO')).toBe(false);

    const sugerido = list.find((c) => c.status === 'suggested')!;
    expect(await backend.mergeItem(sugerido.id, chopp.id)).toBe(true);
    expect(await backend.archiveItem(chopp.id)).toBe(true);
  });

  it('o relatório e a lista do dia vêm do mesmo estado', async () => {
    await as(MARINA);
    const rep = await backend.salesReport();
    const tabs = await backend.listTabs();
    expect(rep.tabs).toBe(tabs.filter((t) => t.status !== 'anulada').length);
    expect(rep.revenueCents).toBeGreaterThan(0);
  });

  it('reabrir só conta fechada; anular conta fechada é recusado', async () => {
    await as(MARINA);
    const ana = (await backend.listTabs()).find((t) => t.customerName.startsWith('Ana'))!;
    expect(await codeOf(backend.reopenTab(ana.id))).toBe('cannot-reopen');
    await backend.closeTab(ana.id, 'dinheiro');
    expect(await codeOf(backend.voidTab(ana.id))).toBe('tab-closed');
    await backend.reopenTab(ana.id);
    expect((await backend.getTab(ana.id)).status).toBe('aberta');
  });

  it('avisa quem acompanha (outra aba) quando algo muda, e o estado persiste', async () => {
    let avisos = 0;
    backend.subscribe(() => (avisos += 1));
    await backend.openTab({ name: 'Nova', phone: '51 99999-0707' });
    expect(avisos).toBe(1);

    const outro = createDemoBackend(); // "outra aba" lendo o mesmo localStorage
    outro.demo.signInAs(MARINA);
    expect((await outro.listTabs()).some((t) => t.customerName === 'Nova')).toBe(true);

    backend.demo.reset();
    expect(await as(MARINA).listTabs()).not.toContainEqual(
      expect.objectContaining({ customerName: 'Nova' }),
    );
  });
});
