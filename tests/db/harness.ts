/* eslint-disable @typescript-eslint/no-explicit-any -- as funções devolvem jsonb, sem tipo fixo */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

/**
 * Banco de teste das comandas: Postgres em memória (PGlite, sem Docker) que
 * imita o essencial do Supabase — papéis `anon`/`authenticated`, `auth.uid()`,
 * `auth.jwt()` e, principalmente, os PRIVILÉGIOS PADRÃO do Supabase, que dão
 * `execute` em toda função nova para anon e authenticated. Reproduzir essa
 * armadilha é o que prova que os `revoke` das migrations realmente seguram.
 *
 * Diferenças que não dá para testar aqui: concorrência real (uma conexão só),
 * Realtime, PostgREST e o Auth de verdade.
 */

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key, email text);

  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;

  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;

  -- O comportamento padrão do Supabase: objetos novos em public nascem abertos.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');

/** Só as migrations das comandas: as do karaokê/legado não fazem parte destes testes. */
function comandaMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /_comandas_.*\.sql$/.test(f))
    .sort();
}

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const file of comandaMigrations()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

export interface Who {
  role: 'anon' | 'authenticated';
  uid?: string;
  /** Login anônimo do Supabase (tem uid, mas não é uma pessoa identificada). */
  anonymous?: boolean;
}

export const ANON: Who = { role: 'anon' };

/** Executa um SQL como `who`, dentro de um savepoint (erro não aborta a transação do teste). */
export async function as<T = unknown>(
  db: PGlite,
  who: Who,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.exec('savepoint t');
  try {
    const claims = JSON.stringify({
      sub: who.uid ?? '',
      role: who.role,
      is_anonymous: who.anonymous ?? false,
    });
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who.uid ?? '']);
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
    await db.exec(`set role ${who.role}`);
    const res = await db.query<T>(sql, params);
    return res.rows;
  } catch (e) {
    await db.exec('rollback to savepoint t');
    throw e;
  } finally {
    await db.exec('reset role');
    await db.exec('release savepoint t').catch(() => undefined);
  }
}

/** Chama uma função pública das comandas como `who` e devolve o jsonb já convertido. */
export async function rpc<T = any>(
  db: PGlite,
  who: Who,
  fn: string,
  args: unknown[] = [],
): Promise<T> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await as<{ r: T }>(db, who, `select public.${fn}(${placeholders}) as r`, args);
  return rows[0].r;
}

/** Mensagem do erro de uma promessa que deve falhar (para `expect(...).toBe('forbidden')`). */
export async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  return '(não falhou)';
}
