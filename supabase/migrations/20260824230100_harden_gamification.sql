-- Hardening pós-advisors da migration de gamificação.
--
-- session_reputation/user_reputation não precisam contornar RLS (points_transactions
-- já é pública) — ao contrário de public_profiles/performance_results, que existem
-- justamente para isso. Toda view sem security_invoker explícito nasce
-- security_invoker=false por padrão no Postgres (comportamento herdado, não algo que
-- eu pedi) — corrigindo para true aqui, que é o certo quando não há bypass a fazer.
alter view public.session_reputation set (security_invoker = true);
alter view public.user_reputation set (security_invoker = true);

-- As 4 funções de premiação só devem rodar como trigger, nunca via
-- /rest/v1/rpc/award_xp_on_* — mesmo padrão de handle_new_user (FASE 2).
revoke execute on function public.award_xp_on_session_join() from public, anon, authenticated;
revoke execute on function public.award_xp_on_vote() from public, anon, authenticated;
revoke execute on function public.award_xp_on_performance_completed() from public, anon, authenticated;
revoke execute on function public.award_xp_on_favorite() from public, anon, authenticated;
