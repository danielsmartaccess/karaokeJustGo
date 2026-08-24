-- Hardening: fixa search_path em funções (evita search_path hijacking) e revoga
-- execução direta via RPC de funções que só devem rodar como trigger.
-- Achado pelo advisor de segurança (get_advisors) após a migration de sessions.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_session_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  attempt int := 0;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.sessions where code = result);
    attempt := attempt + 1;
    if attempt > 20 then
      raise exception 'não foi possível gerar código único de sessão';
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.set_session_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.generate_session_code();
  end if;
  return new;
end;
$$;

-- handle_new_user só deve rodar via trigger on_auth_user_created, nunca chamada
-- diretamente via /rest/v1/rpc/handle_new_user (que falharia mesmo, pois retorna
-- `trigger`, mas o advisor recomenda revogar o EXECUTE explicitamente).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
