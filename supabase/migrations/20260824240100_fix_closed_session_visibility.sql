-- Bug real achado testando a FASE 9 ao vivo: a policy de leitura pública de
-- `sessions` só cobria OPEN/LIVE, então o telão (visitante anônimo, sem ser staff)
-- via "Sessão não encontrada" assim que o host encerrava — bem no momento em que a
-- Performance da Noite deveria aparecer. CLOSED também precisa ser público (a noite
-- acabou, não há razão pra esconder o resumo/prêmio); SCHEDULED continua staff-only
-- (sessão que ainda não abriu não deveria ser navegável por qualquer um).
alter policy "open sessions are publicly readable"
  on public.sessions
  using (
    status in ('OPEN', 'LIVE', 'CLOSED')
    or exists (
      select 1 from public.venue_staff
      where venue_staff.venue_id = sessions.venue_id
        and venue_staff.profile_id = auth.uid()
    )
  );

-- Mesmo raciocínio para `performances`: o telão precisa continuar lendo as
-- apresentações da sessão (pra montar o reveal da Performance da Noite) depois que
-- ela encerra.
alter policy "performances are readable in open/live sessions or by venue staff"
  on public.performances
  using (
    exists (
      select 1 from public.sessions s
      where s.id = performances.session_id
        and (
          s.status in ('OPEN', 'LIVE', 'CLOSED')
          or exists (
            select 1 from public.venue_staff vs
            where vs.venue_id = s.venue_id and vs.profile_id = auth.uid()
          )
        )
    )
  );
