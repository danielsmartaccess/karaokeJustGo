import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createDb } from './harness';

/**
 * O plano de volta funciona: depois do rollback não sobra nenhum objeto `comanda_*`
 * e uma tabela alheia ao prefixo continua intacta.
 */
it('o rollback remove tudo das comandas e só isso', async () => {
  const db = await createDb();
  await db.exec(
    `create table public.karaoke_rooms_demo (id int primary key); insert into public.karaoke_rooms_demo values (1);`,
  );

  const count = async () =>
    (
      await db.query<{ n: number }>(`
        select (
          (select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relname like 'comanda\\_%')
          + (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'comanda\\_%')
          + (select count(*) from pg_type t where t.typnamespace = 'public'::regnamespace and t.typname like 'comanda\\_%' and t.typtype <> 'c' and t.typelem = 0)
        )::int as n`)
    ).rows[0].n;

  expect(await count()).toBeGreaterThan(30);

  const script = readFileSync(
    join(__dirname, '..', '..', 'supabase', 'scripts', 'rollback-comandas.sql'),
    'utf8',
  );
  await db.exec(script);

  expect(await count()).toBe(0);
  expect((await db.query(`select * from public.karaoke_rooms_demo`)).rows).toHaveLength(1);
  await db.close();
}, 60000);
