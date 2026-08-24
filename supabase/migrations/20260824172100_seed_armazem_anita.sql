-- FASE 2: seed do primeiro tenant/venue piloto
-- Armazém Anita entra como DADO, nunca hardcode na aplicação (docs/PRODUCT.md).
-- Idempotente: pode rodar mais de uma vez sem duplicar.

insert into public.tenants (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Just Go Smart Access', 'just-go')
on conflict (slug) do nothing;

insert into public.venues (id, tenant_id, name, slug, city, state)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Armazém Anita',
  'armazem-anita',
  'Porto Alegre',
  'RS'
)
on conflict (tenant_id, slug) do nothing;
