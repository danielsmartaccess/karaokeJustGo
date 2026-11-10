/* eslint-disable @typescript-eslint/no-explicit-any -- as funções devolvem jsonb, sem tipo fixo */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ANON, as, createDb, errorOf, rpc, type Who } from './harness';

/**
 * Testes do banco das comandas (migrations em supabase/migrations/*_comandas_*).
 * Cada teste roda dentro de uma transação desfeita no fim, sobre um Postgres
 * local que imita o Supabase (ver harness.ts). Nada aqui toca banco remoto.
 */

const id = (n: string) => `00000000-0000-0000-0000-0000000000${n}`;
const M: Who = { role: 'authenticated', uid: id('0a') }; // gerente ativo
const W: Who = { role: 'authenticated', uid: id('0b') }; // garçom ativo
const P: Who = { role: 'authenticated', uid: id('0c') }; // garçom pendente
const N: Who = { role: 'authenticated', uid: id('0d') }; // logado, fora da equipe
const AN: Who = { role: 'authenticated', uid: id('0e'), anonymous: true }; // login anônimo

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
}, 60000);
afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec('begin');
  await db.exec(`
    insert into auth.users (id, email) values
      ('${M.uid}', 'marina@exemplo.test'), ('${W.uid}', 'carlos@exemplo.test'),
      ('${P.uid}', 'joao@exemplo.test'), ('${N.uid}', 'visita@exemplo.test'),
      ('${AN.uid}', null);
    insert into public.comanda_staff (user_id, name, role, active) values
      ('${M.uid}', 'Marina', 'gerente', true), ('${W.uid}', 'Carlos', 'garcom', true),
      ('${P.uid}', 'João', 'garcom', false);
    insert into public.comanda_catalog (name, normalized, category, price_cents, status, use_count) values
      ('Chopp', 'chopp', 'Cervejas', 1200, 'approved', 40),
      ('Caipirinha', 'caipirinha', 'Drinks', 2200, 'approved', 18),
      ('Porção de batata frita', 'porcao de batata frita', 'Porções', 3200, 'approved', 20);
  `);
});
afterEach(async () => {
  await db.exec('rollback');
});

// --- Utilidades ---------------------------------------------------------------

/** SQL como superusuário (dono do banco). Em savepoint: um erro esperado não aborta o teste. */
const q = async <T = any>(sql: string, params: unknown[] = []): Promise<T[]> => {
  await db.exec('savepoint q');
  try {
    return (await db.query<T>(sql, params)).rows;
  } catch (e) {
    await db.exec('rollback to savepoint q');
    throw e;
  } finally {
    await db.exec('release savepoint q').catch(() => undefined);
  }
};
const catId = async (name: string) =>
  (await q<{ id: string }>('select id from public.comanda_catalog where name = $1', [name]))[0].id;
const today = async () =>
  (await q<{ d: string }>('select public.comanda_service_day()::text as d'))[0].d;
const yesterday = async () =>
  (await q<{ d: string }>('select (public.comanda_service_day() - 1)::text as d'))[0].d;

const openClient = (name: string, phone: string, table: string | null = null) =>
  rpc(db, ANON, 'comanda_open_tab', [name, phone, table]);
const addById = (who: Who, tab: string, item: string, qty = 1) =>
  rpc(db, who, 'comanda_add_item', [tab, item, null, qty]);
const addTyped = (who: Who, tab: string, name: string, qty = 1) =>
  rpc(db, who, 'comanda_add_item', [tab, null, name, qty]);
const myTab = (tab: string, secret: string) => rpc(db, ANON, 'comanda_get_my_tab', [tab, secret]);

/** Comanda de ONTEM (só o superusuário insere em outro dia). */
async function insertYesterdayTab(code = 1, status = 'aberta') {
  const rows = await q<{ id: string }>(
    `insert into public.comanda_tabs (code, service_day, customer_name, phone_status, opened_by, status)
     values ($1, $2::date, 'Diego', 'sem_celular', 'garcom', $3::public.comanda_tab_status) returning id`,
    [code, await yesterday(), status],
  );
  return rows[0].id;
}

// --- Acesso: o que a chave pública NÃO pode ----------------------------------

describe('acesso por papel', () => {
  const TABELAS = [
    'comanda_staff',
    'comanda_catalog',
    'comanda_tabs',
    'comanda_items',
    'comanda_tab_events',
  ];

  it.each(TABELAS)('anon não lê a tabela %s', async (t) => {
    expect(await errorOf(as(db, ANON, `select * from public.${t}`))).toMatch(/permission denied/);
  });

  it.each(TABELAS)('nem a equipe logada lê %s direto (só pelas funções)', async (t) => {
    expect(await errorOf(as(db, M, `select * from public.${t}`))).toMatch(/permission denied/);
    expect(await errorOf(as(db, W, `select * from public.${t}`))).toMatch(/permission denied/);
  });

  it('ninguém escreve direto nas tabelas', async () => {
    const sql = `insert into public.comanda_catalog (name, normalized) values ('x', 'x')`;
    expect(await errorOf(as(db, ANON, sql))).toMatch(/permission denied/);
    expect(await errorOf(as(db, M, sql))).toMatch(/permission denied/);
  });

  it.each([
    'comanda_menu()',
    "comanda_find_tabs('')",
    'comanda_pending_bills()',
    'comanda_catalog_list()',
    'comanda_staff_list()',
    'comanda_sales_report(null)',
    'comanda_list_tabs(null)',
    'comanda_whoami()',
    'comanda_suggest_pairings(null, 3)',
    'comanda_remove_one(null, null)',
  ])('anon não executa %s', async (call) => {
    expect(await errorOf(as(db, ANON, `select public.${call}`))).toMatch(
      /permission denied for function/,
    );
  });

  it('funções internas não são chamáveis nem por logados', async () => {
    const t = await insertYesterdayTab();
    for (const who of [ANON, M]) {
      expect(await errorOf(as(db, who, `select public.comanda_summary('${t}')`))).toMatch(
        /permission denied/,
      );
      expect(
        await errorOf(
          as(
            db,
            who,
            `select public.comanda_require_role(array['gerente']::public.comanda_staff_role[])`,
          ),
        ),
      ).toMatch(/permission denied/);
      expect(
        await errorOf(as(db, who, `select public.comanda_tab_for_secret('${t}', 'x')`)),
      ).toMatch(/permission denied/);
    }
  });

  it('logado fora da equipe e garçom pendente são recusados', async () => {
    expect(await errorOf(rpc(db, N, 'comanda_find_tabs', ['']))).toBe('forbidden');
    expect(await errorOf(rpc(db, P, 'comanda_find_tabs', ['']))).toBe('forbidden');
    expect(await errorOf(rpc(db, P, 'comanda_menu'))).toBe('forbidden');
    expect(await errorOf(rpc(db, AN, 'comanda_menu'))).toBe('forbidden');
  });

  it('garçom não executa nada do gerente', async () => {
    const tab = (await openClient('Ana', '51 99999-0909')).tab_id;
    expect(await errorOf(rpc(db, W, 'comanda_close_tab', [tab, 'pix', false]))).toBe('forbidden');
    expect(await errorOf(rpc(db, W, 'comanda_sales_report', [null]))).toBe('forbidden');
    expect(await errorOf(rpc(db, W, 'comanda_list_tabs', [null]))).toBe('forbidden');
    expect(await errorOf(rpc(db, W, 'comanda_staff_list'))).toBe('forbidden');
    expect(await errorOf(rpc(db, W, 'comanda_catalog_set_price', [await catId('Chopp'), 1]))).toBe(
      'forbidden',
    );
    expect(await errorOf(rpc(db, W, 'comanda_staff_set_active', [P.uid, true]))).toBe('forbidden');
  });
});

// --- Equipe: cadastro e ativação ---------------------------------------------

describe('equipe', () => {
  it('quem se cadastra entra PENDENTE como garçom e não vê nada até o gerente ativar', async () => {
    const r = await rpc(db, N, 'comanda_register_staff', ['Visita']);
    expect(r).toMatchObject({ registered: true, role: 'garcom', active: false });
    expect(await errorOf(rpc(db, N, 'comanda_find_tabs', ['']))).toBe('forbidden');

    await rpc(db, M, 'comanda_staff_set_active', [N.uid, true]);
    expect(await rpc(db, N, 'comanda_find_tabs', [''])).toEqual([]);
  });

  it('cadastrar-se não rebaixa nem promove quem já existe', async () => {
    expect(await rpc(db, M, 'comanda_register_staff', ['Outro nome'])).toMatchObject({
      role: 'gerente',
      active: true,
      name: 'Marina',
    });
  });

  it('login anônimo e nome inválido não se cadastram', async () => {
    expect(await errorOf(rpc(db, AN, 'comanda_register_staff', ['Anônimo']))).toBe('forbidden');
    expect(await errorOf(rpc(db, N, 'comanda_register_staff', ['   ']))).toBe('invalid-name');
  });

  it('o gerente não desativa a si mesmo nem muda o próprio papel', async () => {
    expect(await errorOf(rpc(db, M, 'comanda_staff_set_active', [M.uid, false]))).toBe(
      'cannot-deactivate-self',
    );
    expect(await errorOf(rpc(db, M, 'comanda_staff_set_role', [M.uid, 'garcom']))).toBe(
      'cannot-change-own-role',
    );
  });

  it('o gerente promove um garçom e desativa outro', async () => {
    await rpc(db, M, 'comanda_staff_set_role', [W.uid, 'gerente']);
    expect(await rpc(db, W, 'comanda_staff_list')).toHaveLength(3);
    await rpc(db, M, 'comanda_staff_set_active', [W.uid, false]);
    expect(await errorOf(rpc(db, W, 'comanda_menu'))).toBe('forbidden');
  });

  it('a lista da equipe traz o e-mail e põe os pendentes primeiro', async () => {
    const list = await rpc(db, M, 'comanda_staff_list');
    expect(list[0]).toMatchObject({ name: 'João', active: false, email: 'joao@exemplo.test' });
  });
});

// --- Cliente ------------------------------------------------------------------

describe('cliente', () => {
  it('abre a comanda, recebe o segredo uma vez e só o hash fica no banco', async () => {
    const r = await openClient('Ana Souza', '51 99999-0909', 'mesa 4');
    expect(r.code).toBe(1);
    expect(r.secret).toHaveLength(64);

    const [row] = await q(
      'select phone, phone_last4, phone_status, secret_hash, service_day::text as d from public.comanda_tabs',
    );
    expect(row).toMatchObject({
      phone: '5551999990909',
      phone_last4: '0909',
      phone_status: 'informado',
    });
    expect(row.d).toBe(await today());
    expect(row.secret_hash).toHaveLength(64);
    expect(row.secret_hash).not.toContain(r.secret);
  });

  it('o número curto é sequencial no dia', async () => {
    const a = await openClient('Ana', '51 99999-0101');
    const b = await openClient('Bruno', '51 99999-0202');
    expect([a.code, b.code]).toEqual([1, 2]);
  });

  it('recusa celular repetido no dia, em qualquer formatação; anular libera o número', async () => {
    const a = await openClient('Ana', '51 99999-0101');
    expect(await errorOf(openClient('Outra', '(51) 99999-0101'))).toBe('phone-already-open');
    expect(await errorOf(openClient('Outra', '+55 51 99999-0101'))).toBe('phone-already-open');

    await rpc(db, M, 'comanda_void_tab', [a.tab_id]);
    expect((await openClient('Outra', '51 99999-0101')).code).toBe(2);
  });

  it('valida nome e celular', async () => {
    expect(await errorOf(openClient('   ', '51 99999-0101'))).toBe('invalid-name');
    expect(await errorOf(openClient('x'.repeat(61), '51 99999-0101'))).toBe('invalid-name');
    expect(await errorOf(openClient('Ana', '12345'))).toBe('invalid-phone');
    expect(await errorOf(openClient('Ana', ''))).toBe('invalid-phone');
    expect(await errorOf(openClient('Ana', '44 51 99999-0101'))).toBe('invalid-phone');
  });

  it('teto de 500 comandas por dia', async () => {
    await q(
      `insert into public.comanda_tabs (code, service_day, customer_name, phone_status, opened_by)
       select g, public.comanda_service_day(), 'x' || g, 'sem_celular', 'garcom' from generate_series(1, 500) g`,
    );
    expect(await errorOf(openClient('Ana', '51 99999-0101'))).toBe('daily-cap');
  });

  it('segredo errado e comanda inexistente dão a MESMA resposta', async () => {
    const a = await openClient('Ana', '51 99999-0101');
    expect(await errorOf(myTab(a.tab_id, 'errado'))).toBe('not-found');
    expect(await errorOf(myTab(id('99'), a.secret))).toBe('not-found');
    expect(await errorOf(myTab(a.tab_id, ''))).toBe('not-found');
  });

  it('comanda aberta pelo garçom (sem celular) não tem acesso do cliente', async () => {
    const t = await rpc(db, W, 'comanda_open_tab_by_staff', ['Carla', '9']);
    expect(await errorOf(myTab(t.tab_id, ''))).toBe('not-found');
  });

  it('vê o próprio consumo e o total parcial', async () => {
    const a = await openClient('Ana', '51 99999-0101');
    await addById(W, a.tab_id, await catId('Chopp'), 3);
    await addById(W, a.tab_id, await catId('Porção de batata frita'), 1);

    const mine = await myTab(a.tab_id, a.secret);
    expect(mine).toMatchObject({ units: 4, total_cents: 6800, unpriced_units: 0 });
    expect(mine.tab).toMatchObject({ code: 1, status: 'aberta', closed_total_cents: null });
    expect(mine.lines).toEqual([
      expect.objectContaining({ name: 'Chopp', qty: 3, total_cents: 3600 }),
      expect.objectContaining({ name: 'Porção de batata frita', qty: 1, total_cents: 3200 }),
    ]);
  });

  it('o cliente pede a conta; pedir de novo não muda nada; o gerente a vê na fila', async () => {
    const a = await openClient('Ana', '51 99999-0101');
    await rpc(db, ANON, 'comanda_request_bill', [a.tab_id, a.secret]);
    const first = (await myTab(a.tab_id, a.secret)).tab;
    expect(first.status).toBe('conta_pedida');

    await rpc(db, ANON, 'comanda_request_bill', [a.tab_id, a.secret]);
    expect((await myTab(a.tab_id, a.secret)).tab.bill_requested_at).toBe(first.bill_requested_at);

    const fila = await rpc(db, M, 'comanda_pending_bills');
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ code: 1, customer_name: 'Ana' });
    expect(await errorOf(rpc(db, W, 'comanda_pending_bills'))).toBe('forbidden');
  });

  it('pedir a conta exige o segredo', async () => {
    const a = await openClient('Ana', '51 99999-0101');
    expect(await errorOf(rpc(db, ANON, 'comanda_request_bill', [a.tab_id, 'errado']))).toBe(
      'not-found',
    );
  });

  it('recuperação de acesso: o segredo novo vale e o antigo morre', async () => {
    const a = await openClient('Ana', '51 99999-0101');
    const novo = await rpc(db, W, 'comanda_reissue_secret', [a.tab_id]);
    expect(await errorOf(myTab(a.tab_id, a.secret))).toBe('not-found');
    expect((await myTab(a.tab_id, novo.secret)).tab.code).toBe(1);

    const semCelular = await rpc(db, W, 'comanda_open_tab_by_staff', ['Carla', null]);
    expect(await errorOf(rpc(db, W, 'comanda_reissue_secret', [semCelular.tab_id]))).toBe(
      'not-found',
    );
  });
});

// --- Garçom: busca, confirmação e lançamento ----------------------------------

describe('garçom', () => {
  it('busca por número, 4 últimos dígitos e nome (sem acento), sem telefone inteiro', async () => {
    await openClient('Ana Souza', '51 99999-0909');
    await openClient('Bruno Lima', '51 99999-0202');

    const byCode = await rpc(db, W, 'comanda_find_tabs', ['2']);
    expect(byCode.map((t: any) => t.customer_name)).toEqual(['Bruno Lima']);
    expect((await rpc(db, W, 'comanda_find_tabs', ['0909']))[0].customer_name).toBe('Ana Souza');
    expect((await rpc(db, W, 'comanda_find_tabs', ['SOUZA']))[0].customer_name).toBe('Ana Souza');
    expect((await rpc(db, W, 'comanda_find_tabs', ['ánà']))[0].customer_name).toBe('Ana Souza');
    expect(await rpc(db, W, 'comanda_find_tabs', ['zzz'])).toEqual([]);
    expect(await rpc(db, W, 'comanda_find_tabs', [''])).toHaveLength(2);

    const found = await rpc(db, W, 'comanda_find_tabs', ['0909']);
    expect(JSON.stringify(found)).not.toContain('5551999990909');
    expect(found[0]).toMatchObject({ phone_last4: '0909' });
  });

  it('nunca acha comanda de outro dia nem anulada', async () => {
    await insertYesterdayTab();
    const a = await openClient('Ana', '51 99999-0101');
    await rpc(db, M, 'comanda_void_tab', [a.tab_id]);
    expect(await rpc(db, W, 'comanda_find_tabs', [''])).toEqual([]);
    expect(await rpc(db, W, 'comanda_find_tabs', ['Diego'])).toEqual([]);
  });

  it('o garçom vê só o final do celular; o gerente vê inteiro', async () => {
    const a = await openClient('Ana', '51 99999-0909');
    const forW = (await rpc(db, W, 'comanda_get_tab', [a.tab_id])).tab;
    expect(forW.phone_last4).toBe('0909');
    expect(forW).not.toHaveProperty('phone');
    expect((await rpc(db, M, 'comanda_get_tab', [a.tab_id])).tab.phone).toBe('5551999990909');
  });

  it('o garçom não abre comanda de ontem; o gerente abre', async () => {
    const y = await insertYesterdayTab();
    expect(await errorOf(rpc(db, W, 'comanda_get_tab', [y]))).toBe('not-found');
    expect((await rpc(db, M, 'comanda_get_tab', [y])).tab.customer_name).toBe('Diego');
  });

  it('abre comanda sem celular (contingência) e valida o nome', async () => {
    const t = await rpc(db, W, 'comanda_open_tab_by_staff', ['Carla', 'mesa do fundo']);
    expect(t.code).toBe(1);
    expect(await errorOf(rpc(db, W, 'comanda_open_tab_by_staff', ['  ', null]))).toBe(
      'invalid-name',
    );
    const [row] = await q('select phone_status, opened_by from public.comanda_tabs');
    expect(row).toEqual({ phone_status: 'sem_celular', opened_by: 'garcom' });
  });

  it('confirma o celular uma vez; sem celular não há o que confirmar', async () => {
    const a = await openClient('Ana', '51 99999-0909');
    expect(await rpc(db, W, 'comanda_confirm_phone', [a.tab_id])).toEqual({ ok: true });
    expect(await rpc(db, W, 'comanda_confirm_phone', [a.tab_id])).toEqual({ ok: false });
    expect((await myTab(a.tab_id, a.secret)).tab.phone_status).toBe('confirmado');

    const c = await rpc(db, W, 'comanda_open_tab_by_staff', ['Carla', null]);
    expect(await rpc(db, W, 'comanda_confirm_phone', [c.tab_id])).toEqual({ ok: false });
  });

  it('o garçom registra que a mesa pediu a conta', async () => {
    const a = await openClient('Ana', '51 99999-0101');
    await rpc(db, W, 'comanda_request_bill_by_staff', [a.tab_id]);
    expect((await myTab(a.tab_id, a.secret)).tab.status).toBe('conta_pedida');
  });
});

describe('lançamento de itens', () => {
  let tab: string;
  beforeEach(async () => {
    tab = (await openClient('Ana', '51 99999-0101')).tab_id;
  });

  it('grava o preço da hora; mudar o catálogo depois NÃO reescreve o passado', async () => {
    const chopp = await catId('Chopp');
    await addById(W, tab, chopp, 2);
    await rpc(db, M, 'comanda_catalog_set_price', [chopp, 1500]);
    await addById(W, tab, chopp, 1);

    const t = await rpc(db, W, 'comanda_get_tab', [tab]);
    expect(t.total_cents).toBe(2 * 1200 + 1500);
  });

  it('item digitado que não existe vira SUGESTÃO sem preço; digitar de novo reaproveita', async () => {
    const a = await addTyped(W, tab, 'Suco de maracujá', 1);
    expect(a.created).toBe(true);
    const b = await addTyped(W, tab, '  SUCO   de maracuja ', 2);
    expect(b.created).toBe(false);

    const rows = await q(
      "select status, category, price_cents, use_count from public.comanda_catalog where normalized = 'suco de maracuja'",
    );
    expect(rows).toEqual([
      { status: 'suggested', category: 'Outros', price_cents: null, use_count: 3 },
    ]);
    expect((await rpc(db, W, 'comanda_get_tab', [tab])).unpriced_units).toBe(3);
  });

  it('o digitado reaproveita item APROVADO existente (acento e caixa não distinguem)', async () => {
    const r = await addTyped(W, tab, 'PORCAO de batata FRITA', 1);
    expect(r.created).toBe(false);
    expect(r.name).toBe('Porção de batata frita');
  });

  it('valida a quantidade e o nome', async () => {
    const chopp = await catId('Chopp');
    for (const qty of [0, -1, 100, null]) {
      expect(await errorOf(addById(W, tab, chopp, qty as number))).toBe('invalid-qty');
    }
    expect(await errorOf(addTyped(W, tab, '   ', 1))).toBe('empty-name');
    expect(await errorOf(addById(W, id('99'), chopp, 1))).toBe('tab-not-found');
  });

  it('só lança em comanda de hoje, aberta ou com a conta pedida', async () => {
    const chopp = await catId('Chopp');
    const y = await insertYesterdayTab();
    expect(await errorOf(addById(W, y, chopp))).toBe('tab-not-open-today');

    await rpc(db, W, 'comanda_request_bill_by_staff', [tab]);
    await addById(W, tab, chopp); // com a conta pedida ainda aceita

    await rpc(db, M, 'comanda_void_tab', [tab]);
    expect(await errorOf(addById(W, tab, chopp))).toBe('tab-not-open-today');
  });

  it('estorno parcial: tira uma de três; não estorna mais do que resta', async () => {
    const item = (await addById(W, tab, await catId('Chopp'), 3)).item_id;

    expect(await rpc(db, W, 'comanda_reverse_item', [item, 1])).toEqual({ ok: true });
    expect((await rpc(db, W, 'comanda_get_tab', [tab])).total_cents).toBe(2 * 1200);

    expect(await rpc(db, W, 'comanda_reverse_item', [item, 3])).toEqual({ ok: false });
    expect(await rpc(db, W, 'comanda_reverse_item', [item, 0])).toEqual({ ok: false });
    expect(await rpc(db, W, 'comanda_reverse_item', [item, null])).toEqual({ ok: true }); // o que resta
    expect(await rpc(db, W, 'comanda_reverse_item', [item, null])).toEqual({ ok: false });

    const t = await rpc(db, W, 'comanda_get_tab', [tab]);
    expect(t.total_cents).toBe(0);
    expect(t.lines).toEqual([]);
    expect(t.ledger.find((l: any) => l.id === item).remaining).toBe(0);
  });

  it('estornar uma linha de estorno, ou uma inexistente, não faz nada', async () => {
    const item = (await addById(W, tab, await catId('Chopp'), 2)).item_id;
    await rpc(db, W, 'comanda_reverse_item', [item, 1]);
    const [rev] = await q<{ id: string }>('select id from public.comanda_items where qty < 0');
    expect(await rpc(db, W, 'comanda_reverse_item', [rev.id, 1])).toEqual({ ok: false });
    expect(await rpc(db, W, 'comanda_reverse_item', [id('99'), 1])).toEqual({ ok: false });
  });

  it('o estorno de conta fechada é recusado', async () => {
    const item = (await addById(W, tab, await catId('Chopp'), 2)).item_id;
    await rpc(db, M, 'comanda_close_tab', [tab, 'pix', false]);
    expect(await errorOf(rpc(db, W, 'comanda_reverse_item', [item, 1]))).toBe('tab-not-open-today');
  });

  it('o livro-razão é só de acréscimo: nem o dono altera ou apaga um lançamento', async () => {
    await addById(W, tab, await catId('Chopp'), 2);
    expect(await errorOf(q('update public.comanda_items set qty = 9'))).toBe('append-only');
    expect(await errorOf(q('delete from public.comanda_items'))).toBe('append-only');
    expect(await errorOf(q("update public.comanda_tab_events set kind = 'x'"))).toBe('append-only');
    expect(await errorOf(q('delete from public.comanda_tabs'))).toBe('append-only');
  });
});

// --- Preço, catálogo e junção ---------------------------------------------------

describe('catálogo e preço', () => {
  let tab: string;
  beforeEach(async () => {
    tab = (await openClient('Ana', '51 99999-0101')).tab_id;
  });

  it('precificar DEPOIS fecha a venda feita sem preço', async () => {
    await addById(W, tab, await catId('Caipirinha'), 2);
    await addTyped(W, tab, 'Pastel', 2);
    expect(await rpc(db, W, 'comanda_get_tab', [tab])).toMatchObject({
      total_cents: 4400,
      unpriced_units: 2,
    });

    await rpc(db, M, 'comanda_catalog_set_price', [await catId('Pastel'), 1000]);
    expect(await rpc(db, W, 'comanda_get_tab', [tab])).toMatchObject({
      total_cents: 6400,
      unpriced_units: 0,
    });
  });

  it('valida o preço e deixa limpar', async () => {
    const chopp = await catId('Chopp');
    expect(await errorOf(rpc(db, M, 'comanda_catalog_set_price', [chopp, -1]))).toBe(
      'invalid-price',
    );
    expect(await errorOf(rpc(db, M, 'comanda_catalog_set_price', [chopp, 10000001]))).toBe(
      'invalid-price',
    );
    expect(await rpc(db, M, 'comanda_catalog_set_price', [chopp, null])).toEqual({ ok: true });
    expect(await rpc(db, M, 'comanda_catalog_set_price', [id('99'), 100])).toEqual({ ok: false });
  });

  it('o gerente aprova, renomeia, arquiva e cria itens, sem duplicar nomes', async () => {
    const novo = await rpc(db, M, 'comanda_catalog_add', ['Tábua de frios', 'Porções', 5800]);
    expect(novo.ok).toBe(true);
    expect(await rpc(db, M, 'comanda_catalog_add', ['TABUA de frios', null, null])).toEqual({
      ok: false,
      reason: 'exists',
    });

    await addTyped(W, tab, 'Caldinho', 1);
    const caldinho = await catId('Caldinho');
    expect(await rpc(db, M, 'comanda_catalog_approve', [caldinho])).toEqual({ ok: true });
    expect(await errorOf(rpc(db, M, 'comanda_catalog_rename', [caldinho, 'chopp']))).toBe(
      'name-taken',
    );
    expect(await rpc(db, M, 'comanda_catalog_rename', [caldinho, 'Caldinho de feijão'])).toEqual({
      ok: true,
    });

    await rpc(db, M, 'comanda_catalog_archive', [caldinho]);
    const menu = await rpc(db, W, 'comanda_menu');
    expect(menu.map((m: any) => m.name)).not.toContain('Caldinho de feijão');
    const all = await rpc(db, M, 'comanda_catalog_list');
    expect(all.find((m: any) => m.name === 'Caldinho de feijão').status).toBe('archived');
  });

  it('o cardápio do garçom vem com preço e os mais vendidos primeiro', async () => {
    const menu = await rpc(db, W, 'comanda_menu');
    expect(menu[0]).toMatchObject({ name: 'Chopp', price_cents: 1200 });
  });

  it('juntar duplicata: os totais passam a somar no item de destino', async () => {
    await addById(W, tab, await catId('Chopp'), 1);
    await addTyped(W, tab, 'Chopp gelado', 2);
    expect((await rpc(db, W, 'comanda_get_tab', [tab])).lines).toHaveLength(2);

    await rpc(db, M, 'comanda_catalog_merge', [await catId('Chopp gelado'), await catId('Chopp')]);
    const t = await rpc(db, W, 'comanda_get_tab', [tab]);
    expect(t.lines).toEqual([
      expect.objectContaining({ name: 'Chopp', qty: 3, total_cents: 3600 }),
    ]);
    expect(t.unpriced_units).toBe(0);

    // O nome antigo agora lança no destino, não recria a duplicata.
    const r = await addTyped(W, tab, 'Chopp gelado', 1);
    expect(r.name).toBe('Chopp gelado'); // arquivado e juntado: cria de novo como sugestão
  });

  it('juntar a si mesmo ou a algo inexistente não faz nada', async () => {
    const chopp = await catId('Chopp');
    expect(await rpc(db, M, 'comanda_catalog_merge', [chopp, chopp])).toEqual({ ok: false });
    expect(await rpc(db, M, 'comanda_catalog_merge', [chopp, id('99')])).toEqual({ ok: false });
  });
});

// --- Fechamento da conta --------------------------------------------------------

describe('fechamento da conta', () => {
  let tab: string;
  let secret: string;
  beforeEach(async () => {
    const a = await openClient('Ana', '51 99999-0101');
    tab = a.tab_id;
    secret = a.secret;
    await addById(W, tab, await catId('Chopp'), 3);
  });

  it('congela o total e registra a forma de pagamento; o cliente vê a conta final', async () => {
    const r = await rpc(db, M, 'comanda_close_tab', [tab, 'cartao', false]);
    expect(r).toEqual({ ok: true, total_cents: 3600, unpriced_units: 0 });

    const mine = await myTab(tab, secret);
    expect(mine.tab).toMatchObject({ status: 'fechada', closed_total_cents: 3600 });
    const [row] = await q('select payment_method, closed_by from public.comanda_tabs');
    expect(row).toEqual({ payment_method: 'cartao', closed_by: M.uid });
  });

  it('recusa forma de pagamento inválida e comanda inexistente', async () => {
    expect(await errorOf(rpc(db, M, 'comanda_close_tab', [tab, 'cheque', false]))).toBe(
      'invalid-payment-method',
    );
    expect(await errorOf(rpc(db, M, 'comanda_close_tab', [tab, null, false]))).toBe(
      'invalid-payment-method',
    );
    expect(await errorOf(rpc(db, M, 'comanda_close_tab', [id('99'), 'pix', false]))).toBe(
      'not-found',
    );
  });

  it('com item SEM preço recusa, a menos que o gerente aceite; o total congelado não muda depois', async () => {
    await addTyped(W, tab, 'Pastel', 2);
    expect(await errorOf(rpc(db, M, 'comanda_close_tab', [tab, 'pix', false]))).toBe(
      'unpriced-items',
    );

    const r = await rpc(db, M, 'comanda_close_tab', [tab, 'pix', true]);
    expect(r).toEqual({ ok: true, total_cents: 3600, unpriced_units: 2 });

    // Precificar depois altera o cálculo vivo, mas a conta fechada continua a mesma.
    await rpc(db, M, 'comanda_catalog_set_price', [await catId('Pastel'), 1000]);
    const mine = await myTab(tab, secret);
    expect(mine.tab.closed_total_cents).toBe(3600);
  });

  it('depois de fechada: não lança, não pede conta, não fecha de novo, não anula', async () => {
    await rpc(db, M, 'comanda_close_tab', [tab, 'dinheiro', false]);
    expect(await errorOf(addById(W, tab, await catId('Chopp')))).toBe('tab-not-open-today');
    expect(await errorOf(rpc(db, ANON, 'comanda_request_bill', [tab, secret]))).toBe('tab-closed');
    expect(await errorOf(rpc(db, W, 'comanda_request_bill_by_staff', [tab]))).toBe('tab-closed');
    expect(await errorOf(rpc(db, M, 'comanda_close_tab', [tab, 'pix', false]))).toBe('tab-closed');
    expect(await errorOf(rpc(db, M, 'comanda_void_tab', [tab]))).toBe('tab-closed');
  });

  it('reabrir descarta o total congelado e volta a aceitar itens; a auditoria guarda tudo', async () => {
    await rpc(db, M, 'comanda_close_tab', [tab, 'pix', false]);
    await rpc(db, M, 'comanda_reopen_tab', [tab]);

    const mine = await myTab(tab, secret);
    expect(mine.tab).toMatchObject({ status: 'aberta', closed_total_cents: null });
    await addById(W, tab, await catId('Chopp')); // aceita de novo

    const kinds = (
      await q<{ kind: string }>('select kind from public.comanda_tab_events order by id')
    ).map((e) => e.kind);
    expect(kinds).toEqual(['opened_by_client', 'closed', 'reopened']);
    const [ev] = await q("select detail from public.comanda_tab_events where kind = 'reopened'");
    expect(ev.detail).toEqual({ previous_total_cents: 3600 });
  });

  it('só reabre conta fechada hoje', async () => {
    expect(await errorOf(rpc(db, M, 'comanda_reopen_tab', [tab]))).toBe('cannot-reopen'); // ainda aberta
    const y = await insertYesterdayTab(7, 'fechada');
    expect(await errorOf(rpc(db, M, 'comanda_reopen_tab', [y]))).toBe('cannot-reopen');
  });

  it('o gerente fecha também comanda aberta de ontem (limpeza)', async () => {
    const y = await insertYesterdayTab(8, 'aberta');
    expect(await rpc(db, M, 'comanda_close_tab', [y, 'outro', false])).toMatchObject({
      ok: true,
      total_cents: 0,
    });
  });

  it('comanda anulada sai do relatório e da busca mas continua existindo', async () => {
    await rpc(db, M, 'comanda_void_tab', [tab]);
    expect((await rpc(db, M, 'comanda_sales_report', [null])).tabs).toBe(0);
    expect((await q('select count(*)::int as n from public.comanda_tabs'))[0].n).toBe(1);
    expect((await rpc(db, M, 'comanda_list_tabs', [null]))[0].status).toBe('anulada');
  });
});

// --- Relatório de vendas ----------------------------------------------------------

describe('relatório de vendas', () => {
  it('faturamento, ticket médio, itens por comanda e mais vendidos', async () => {
    const a = await openClient('Ana', '51 99999-0101');
    const b = await openClient('Bruno', '51 99999-0202');
    const c = await rpc(db, W, 'comanda_open_tab_by_staff', ['Carla', null]);
    await addById(W, a.tab_id, await catId('Chopp'), 3);
    await addById(W, a.tab_id, await catId('Porção de batata frita'), 1);
    await addById(W, b.tab_id, await catId('Caipirinha'), 2);

    const r = await rpc(db, M, 'comanda_sales_report', [null]);
    expect(r).toMatchObject({
      tabs: 3,
      units: 6,
      revenue_cents: 6800 + 4400,
      unpriced_units: 0,
      avg_ticket_cents: 5600, // só entre as comandas com valor (Carla não tem)
      units_per_tab: 2,
    });
    expect(r.top.map((t: any) => [t.name, t.units, t.revenue_cents])).toEqual([
      ['Chopp', 3, 3600],
      ['Caipirinha', 2, 4400],
      ['Porção de batata frita', 1, 3200],
    ]);

    await addTyped(W, c.tab_id, 'Brinde', 1);
    const sem = await rpc(db, M, 'comanda_sales_report', [null]);
    expect(sem.unpriced_units).toBe(1);
    expect(sem.unpriced_items).toEqual([expect.objectContaining({ name: 'Brinde', units: 1 })]);
  });

  it('conta fechada entra pelo total congelado', async () => {
    const a = await openClient('Ana', '51 99999-0101');
    await addById(W, a.tab_id, await catId('Chopp'), 2);
    await addTyped(W, a.tab_id, 'Pastel', 1);
    await rpc(db, M, 'comanda_close_tab', [a.tab_id, 'pix', true]);
    await rpc(db, M, 'comanda_catalog_set_price', [await catId('Pastel'), 5000]);

    expect((await rpc(db, M, 'comanda_sales_report', [null])).revenue_cents).toBe(2400);
  });

  it('dia sem comandas devolve zeros, sem dividir por zero', async () => {
    expect(await rpc(db, M, 'comanda_sales_report', ['2020-01-01'])).toMatchObject({
      tabs: 0,
      units: 0,
      revenue_cents: 0,
      avg_ticket_cents: 0,
      units_per_tab: 0,
      top: [],
      unpriced_items: [],
    });
  });

  it('lista as comandas de um dia com o telefone inteiro', async () => {
    await openClient('Ana', '51 99999-0101');
    const list = await rpc(db, M, 'comanda_list_tabs', [null]);
    expect(list[0]).toMatchObject({ customer_name: 'Ana', phone: '5551999990101' });
  });
});

// --- Funções puras: dia de serviço e normalização --------------------------------

describe('regras puras', () => {
  const day = async (iso: string) =>
    (
      await q<{ d: string }>('select public.comanda_service_day($1::timestamptz)::text as d', [iso])
    )[0].d;

  it('o dia de serviço vira às 6h de São Paulo', async () => {
    expect(await day('2026-11-03T05:59:00-03:00')).toBe('2026-11-02');
    expect(await day('2026-11-03T06:00:00-03:00')).toBe('2026-11-03');
    expect(await day('2026-11-03T23:30:00-03:00')).toBe('2026-11-03');
    expect(await day('2026-11-04T00:30:00-03:00')).toBe('2026-11-03'); // noite que vira
    expect(await day('2026-11-04T05:30:00-03:00')).toBe('2026-11-03');
  });

  it('o dia não depende do fuso do servidor (UTC dá o mesmo)', async () => {
    expect(await day('2026-11-03T08:59:00Z')).toBe('2026-11-02'); // 05:59 em São Paulo
    expect(await day('2026-11-03T09:00:00Z')).toBe('2026-11-03'); // 06:00 em São Paulo
  });

  it.each([
    ['  Água   com GÁS  ', 'agua com gas'],
    ['Pão de Açúcar', 'pao de acucar'],
    ['CAIPIRINHA', 'caipirinha'],
    ['', ''],
  ])('normaliza "%s" como o app', async (entrada, esperado) => {
    expect(
      (await q<{ n: string }>('select public.comanda_normalize($1) as n', [entrada]))[0].n,
    ).toBe(esperado);
  });

  it.each([
    ['(51) 99999-0101', '5551999990101'],
    ['5551999990101', '5551999990101'],
    ['51 3333-0101', '555133330101'],
    ['12345', null],
    ['4451999990101', null],
  ])('telefone "%s" vira %s', async (entrada, esperado) => {
    expect(
      (
        await q<{ p: string | null }>('select public.comanda_normalize_phone($1) as p', [entrada])
      )[0].p,
    ).toBe(esperado);
  });
});

// --- Venda sugestiva e o "−" do cardápio -----------------------------------------

describe('apoio à venda', () => {
  beforeEach(async () => {
    await q(`insert into public.comanda_catalog (name, normalized, category, price_cents, status, use_count) values
      ('Isca de frango', 'isca de frango', 'Porções', 3800, 'approved', 9),
      ('Refrigerante lata', 'refrigerante lata', 'Sem álcool', 800, 'approved', 15)`);
  });

  /** Comanda de ontem já com consumo (histórico que alimenta a sugestão). */
  async function pastTab(code: number, items: [string, number][], status = 'aberta') {
    const [{ id: tab }] = await q<{ id: string }>(
      `insert into public.comanda_tabs (code, service_day, customer_name, phone_status, opened_by, status)
       values ($1::int, $2::date, 'Histórico ' || $1::int, 'sem_celular', 'garcom', $3::public.comanda_tab_status) returning id`,
      [code, await yesterday(), status],
    );
    for (const [name, qty] of items) {
      await q(
        `insert into public.comanda_items (tab_id, catalog_item_id, name_snapshot, qty, added_by)
         select $1, c.id, c.name, $3, $4 from public.comanda_catalog c where c.name = $2`,
        [tab, name, qty, W.uid],
      );
    }
    return tab;
  }

  it('quem pediu caipirinha costuma pedir isca de frango', async () => {
    await pastTab(1, [
      ['Caipirinha', 3],
      ['Isca de frango', 1],
    ]);
    await pastTab(2, [
      ['Caipirinha', 2],
      ['Isca de frango', 1],
      ['Refrigerante lata', 2],
    ]);
    await pastTab(3, [
      ['Chopp', 4],
      ['Porção de batata frita', 1],
    ]);

    const carla = (await rpc(db, W, 'comanda_open_tab_by_staff', ['Carla', null])).tab_id;
    await addById(W, carla, await catId('Caipirinha'), 2);

    const r = await rpc(db, W, 'comanda_suggest_pairings', [carla, 3]);
    expect(r[0]).toMatchObject({
      name: 'Isca de frango',
      because: 'Caipirinha',
      tabs: 2,
      price_cents: 3800,
    });
    expect(r.map((x: any) => x.name)).toEqual(['Isca de frango', 'Refrigerante lata']);
  });

  it('não sugere o que a comanda já tem, e comanda vazia não recebe sugestão', async () => {
    await pastTab(1, [
      ['Chopp', 3],
      ['Porção de batata frita', 1],
    ]);
    const ana = (await openClient('Ana', '51 99999-0101')).tab_id;
    expect(await rpc(db, W, 'comanda_suggest_pairings', [ana, 3])).toEqual([]);

    await addById(W, ana, await catId('Chopp'), 1);
    await addById(W, ana, await catId('Porção de batata frita'), 1);
    expect(await rpc(db, W, 'comanda_suggest_pairings', [ana, 3])).toEqual([]);
  });

  it('ignora comandas anuladas e itens arquivados; respeita o limite', async () => {
    await pastTab(
      1,
      [
        ['Caipirinha', 1],
        ['Isca de frango', 1],
      ],
      'anulada',
    );
    await pastTab(2, [
      ['Caipirinha', 1],
      ['Refrigerante lata', 1],
      ['Porção de batata frita', 1],
    ]);
    const carla = (await rpc(db, W, 'comanda_open_tab_by_staff', ['Carla', null])).tab_id;
    await addById(W, carla, await catId('Caipirinha'), 1);

    const names = async (limit: number) =>
      (await rpc(db, W, 'comanda_suggest_pairings', [carla, limit])).map((x: any) => x.name);
    expect(await names(5)).not.toContain('Isca de frango'); // só veio de comanda anulada
    expect(await names(1)).toHaveLength(1);
    expect(await names(0)).toEqual([]);

    await rpc(db, M, 'comanda_catalog_archive', [await catId('Refrigerante lata')]);
    expect(await names(5)).not.toContain('Refrigerante lata');
  });

  it('o "−" tira uma unidade da linha mais recente que ainda tem saldo', async () => {
    const tab = (await openClient('Ana', '51 99999-0101')).tab_id;
    const chopp = await catId('Chopp');
    await addById(W, tab, chopp, 3);
    await addById(W, tab, chopp, 2);

    expect(await rpc(db, W, 'comanda_remove_one', [tab, chopp])).toEqual({ ok: true });
    const t = await rpc(db, W, 'comanda_get_tab', [tab]);
    expect(t.lines[0].qty).toBe(4);
    expect(t.ledger.find((l: any) => l.qty === 2).remaining).toBe(1); // a mais recente

    for (let i = 0; i < 4; i++) {
      expect(await rpc(db, W, 'comanda_remove_one', [tab, chopp])).toEqual({ ok: true });
    }
    expect(await rpc(db, W, 'comanda_remove_one', [tab, chopp])).toEqual({ ok: false });
    expect((await rpc(db, W, 'comanda_get_tab', [tab])).total_cents).toBe(0);
  });

  it('o "−" em item que a comanda não tem não faz nada; em conta fechada é recusado', async () => {
    const tab = (await openClient('Ana', '51 99999-0101')).tab_id;
    await addById(W, tab, await catId('Chopp'), 1);
    expect(await rpc(db, W, 'comanda_remove_one', [tab, await catId('Caipirinha')])).toEqual({
      ok: false,
    });
    expect(await rpc(db, W, 'comanda_remove_one', [tab, id('99')])).toEqual({ ok: false });
    expect(await errorOf(rpc(db, W, 'comanda_remove_one', [id('99'), await catId('Chopp')]))).toBe(
      'tab-not-found',
    );

    await rpc(db, M, 'comanda_close_tab', [tab, 'pix', false]);
    expect(await errorOf(rpc(db, W, 'comanda_remove_one', [tab, await catId('Chopp')]))).toBe(
      'tab-not-open-today',
    );
  });

  it('o "−" pelo nome de uma duplicata juntada tira do item de destino', async () => {
    const tab = (await openClient('Ana', '51 99999-0101')).tab_id;
    await addById(W, tab, await catId('Chopp'), 1);
    await addTyped(W, tab, 'Chopp gelado', 1);
    const gelado = await catId('Chopp gelado');
    await rpc(db, M, 'comanda_catalog_merge', [gelado, await catId('Chopp')]);

    expect(await rpc(db, W, 'comanda_remove_one', [tab, gelado])).toEqual({ ok: true });
    expect((await rpc(db, W, 'comanda_get_tab', [tab])).units).toBe(1);
  });

  it('só a equipe ativa usa estas funções', async () => {
    const tab = (await openClient('Ana', '51 99999-0101')).tab_id;
    expect(await errorOf(rpc(db, P, 'comanda_suggest_pairings', [tab, 3]))).toBe('forbidden');
    expect(await errorOf(rpc(db, N, 'comanda_remove_one', [tab, await catId('Chopp')]))).toBe(
      'forbidden',
    );
  });
});
