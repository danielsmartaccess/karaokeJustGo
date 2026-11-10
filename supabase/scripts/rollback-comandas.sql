-- =============================================================================
-- Desfaz TUDO que as migrations das comandas criaram.
--
-- DESTRUTIVO: apaga as comandas, os itens, o catálogo e a equipe das comandas.
-- Só rode com ordem explícita do dono. Não toca no karaokê nem em nenhuma tabela
-- fora do prefixo `comanda_` (as migrations das comandas são aditivas).
--
-- Depois de rodar, remova também as linhas de supabase_migrations.schema_migrations
-- das 5 migrations `*_comandas_*`, para o histórico bater com o banco.
-- =============================================================================

-- 1. Tabelas (leva junto os gatilhos, índices e políticas).
drop table if exists
  public.comanda_tab_events,
  public.comanda_items,
  public.comanda_tabs,
  public.comanda_catalog,
  public.comanda_staff
cascade;

-- 2. Funções (qualquer assinatura que comece com comanda_).
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname like 'comanda\_%'
  loop
    execute 'drop function ' || r.sig;
  end loop;
end;
$$;

-- 3. Tipos.
drop type if exists
  public.comanda_staff_role,
  public.comanda_tab_status,
  public.comanda_phone_status,
  public.comanda_catalog_status;
