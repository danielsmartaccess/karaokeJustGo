# Guia de Produção — Just Go Karaoke

Runbook operacional do MVP em produção. Para o mecanismo de deploy em si, veja
[`DEPLOYMENT.md`](./DEPLOYMENT.md); para decisões de segurança, [`SECURITY.md`](./SECURITY.md).

- **URL de produção:** <https://danielsmartaccess.github.io/karaokeJustGo/>
- **Frontend:** GitHub Pages, publicado pelo GitHub Actions a cada push em `main`.
- **Backend:** Supabase (projeto `ghtltnxrmskllagitiap`, região `sa-east-1`, plano ~US$10/mês).
- **Venue piloto:** Armazém Anita (`armazem-anita`), tenant `just-go`.

---

## 1. Arquitetura em produção (visão rápida)

```
Participante (celular)  ─┐
Host (tablet/notebook)  ─┼─►  GitHub Pages (SPA React)  ──►  Supabase
Telão (TV/projetor)     ─┘        static + PWA               Postgres + Auth + Realtime
```

- **Uma** SPA serve as três experiências por rota:
  - `/` landing · `/join/:code` participante · `/songs` `/queue` `/vote` `/profile`
  - `/host` painel do host
  - `/display` e `/display/session/:code` telão (público, sem login)
- Estado ao vivo (fila, votação 60s, XP) via **Supabase Realtime** (`postgres_changes`).
- Fechamento automático da janela de voto de 60s é `setTimeout` no browser do **host** —
  **a aba do host precisa ficar aberta e ativa** durante a rodada.
- Autenticação: **Supabase Anonymous Auth** para participante e host. O papel de
  host/admin vem da tabela `venue_staff`, nunca do login.

---

## 2. Pré-requisitos de infraestrutura (configuração única)

Já aplicados neste projeto — checklist para reprovisionar ou auditar:

| Item | Onde | Estado esperado |
|---|---|---|
| Pages source = GitHub Actions | Settings → Pages | Ativo |
| Secret `VITE_SUPABASE_URL` | Settings → Secrets and variables → Actions | Definido |
| Secret `VITE_SUPABASE_ANON_KEY` | idem (aba Secrets) | Definido (publishable key) |
| Variable `VITE_DEFAULT_VENUE_SLUG` | idem (aba Variables) | `armazem-anita` |
| Anonymous sign-ins | Supabase → Authentication → Sign In / Providers → Anonymous | **Habilitado** |
| Migrations aplicadas | `supabase/migrations/` | Todas no remoto |
| Primeiro host em `venue_staff` | tabela `public.venue_staff` | ≥ 1 linha `ADMIN` no venue |

> A `VITE_SUPABASE_ANON_KEY` é a chave **publishable** (`sb_publishable_…`): ela é
> desenhada para ir no bundle do front. Nunca coloque a `service_role` key no
> frontend nem em secrets do Actions.

---

## 3. Deploy (colocar uma versão nova no ar)

1. Localmente, rodar o checklist de release:
   ```bash
   npm run lint
   npm run test
   npm run build      # precisa das VITE_* no .env local
   ```
2. `git push origin main`.
3. Acompanhar **Actions → "CI & Deploy"**. O job `quality` roda lint + testes + build;
   o job `deploy` só roda em `main` e só se `quality` passou.
4. Quando o deploy terminar, validar a URL de produção (aba anônima, para não pegar
   cache/Service Worker antigo).

**Rollback:** `git revert <sha>` + push (recria o deploy a partir do estado anterior),
ou no GitHub: **Actions → run anterior verde → "Re-run all jobs"**. O banco não é
afetado por rollback de frontend.

**PWA / cache:** o Service Worker usa `registerType: 'autoUpdate'`. Um usuário com o
app aberto recebe a versão nova no próximo carregamento; se algo parecer "preso",
orientar a fechar todas as abas do app ou usar "Atualizar" no navegador.

---

## 4. Bootstrap de um host (dar acesso ao painel `/host`)

Não existe UI de auto-promoção — é um ato de confiança explícito.

1. A pessoa abre **`/host`** uma vez no dispositivo que vai usar na noite (isso cria
   o profile anônimo automaticamente).
2. A tela mostra "sem permissão de host" com um **id de perfil**. Copiar esse id.
3. Inserir em `venue_staff` (via Supabase SQL editor ou MCP):
   ```sql
   insert into public.venue_staff (venue_id, profile_id, role)
   select v.id, '<PROFILE_ID_COPIADO>', 'ADMIN'
   from public.venues v
   where v.slug = 'armazem-anita'
   on conflict do nothing;
   ```
4. A pessoa recarrega `/host` — o painel aparece.

> O `localStorage` daquele dispositivo/navegador é a identidade. Trocar de aparelho,
> limpar dados do site ou usar aba anônima = nova identidade = novo bootstrap.
> Para a noite, use sempre o **mesmo aparelho/navegador** no host.

---

## 5. Operação da noite

### Antes de abrir a casa
- [ ] (Opcional) Limpar dados de teste: rodar `supabase/reset-test-round.sql`
      (`TRUNCATE public.sessions CASCADE` — apaga sessões/apresentações/votos/XP/prêmios,
      **preserva** tenant, venue, `venue_staff` e identidades).
- [ ] Confirmar que o host consegue abrir `/host` e vê o painel.
- [ ] Telão: abrir `/display` num navegador em tela cheia (F11). Deixar o volume da TV
      num nível utilizável — o vídeo do YouTube pode exigir **1 clique** no telão para
      liberar o autoplay com som.

### Abrir a sessão
1. Host em `/host` → **criar sessão** → status vira `OPEN`.
2. O painel mostra o **código de 6 caracteres** e QR codes para:
   - entrada do participante (`/join/<code>`)
   - telão (`/display/session/<code>`)
3. Divulgar o QR de entrada nas mesas. O telão pode exibir o mesmo QR.

### Durante a noite
- Participante: entra pelo QR → pede música (texto livre, ex.: "Evidências") → entra na fila.
- Host: para cada pessoa da fila → **Chamar** → **Marcar cantando**. No card do chamado,
  colar o **link do YouTube** do karaokê (buscar "<música> karaokê" no YouTube por fora).
- Ao fim da música: host abre a **votação** (janela de 60s, nota 1–5). O telão e os
  celulares mostram o resultado agregado automaticamente.
- **Modo DJ** (música ambiente entre apresentações): seção "🎧 Tocar agora" no `/host`,
  colar um link do YouTube — toca no telão quando não há ninguém cantando.

### Encerrar
1. Host → **Encerrar sessão** (status `CLOSED`).
2. Aparece o botão **"Anunciar Performance da Noite"** — o vencedor é calculado pelo
   servidor (maior nota média entre apresentações concluídas); o host só dispara.
3. O telão faz o _reveal_ dourado; a fila mostra o aviso aos participantes.

---

## 6. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Tela branca / "Supabase não configurado" | build sem `VITE_SUPABASE_URL`/`ANON_KEY` | conferir secrets no Actions e refazer o deploy |
| "VITE_DEFAULT_VENUE_SLUG não configurado" | falta a _variable_ no Actions | adicionar `VITE_DEFAULT_VENUE_SLUG=armazem-anita` e refazer o deploy |
| `/host` diz "Anonymous sign-ins are disabled" | provider desligado no Supabase | Authentication → Providers → Anonymous → habilitar |
| Host abre `/host` e fica "sem permissão" | identidade sem linha em `venue_staff` | rodar o bootstrap da seção 4 com o profile id da tela |
| Participante não vê a fila atualizar | Realtime bloqueado (rede corporativa / WebSocket) | trocar para 4G/hotspot; recarregar a aba |
| Votação não fecha aos 60s | aba do host foi fechada/suspensa | manter `/host` aberto e em primeiro plano; se necessário, encerrar a votação manualmente |
| Telão mostra "Sessão não encontrada" após encerrar | cache antigo do SPA | recarregar o `/display` (as policies já liberam sessão `CLOSED`) |
| Vídeo do YouTube não dá play sozinho | política de autoplay do navegador | clicar uma vez no telão |
| Deep-link (`/karaokeJustGo/host`) dá 404 | `404.html` ausente no deploy | conferir passo "SPA fallback" no workflow |
| Deploy falha em "Creating Pages deployment failed / Not Found" | Pages não habilitado | Settings → Pages → Source = GitHub Actions |

**Logs e diagnóstico do backend:** Supabase Dashboard → Logs (Postgres / Auth / Realtime).
Rodar os _advisors_ de segurança e performance após qualquer mudança de schema.

---

## 7. Limites conhecidos do MVP

- Sem domínio próprio (roda no subcaminho `/karaokeJustGo/` do github.io).
- Sessão de voto 60s depende do browser do host aberto (sem cron/Edge Function).
- "Presença na sessão" é uma linha em `session_participants`, não presença efêmera
  via WebSocket — quem fecha o app sem sair continua contando como presente.
- Um único prêmio ("Performance da Noite"); XP/badges são um conjunto fechado do domínio.
- Identidade do host é por dispositivo (`localStorage`).
- Sem painel de métricas de negócio — consultas diretas no Supabase quando preciso.

---

## 8. Custos

| Item | Custo |
|---|---|
| GitHub Pages + Actions (repo público) | US$0 |
| Supabase (plano Pro do projeto) | ~US$10/mês |
| YouTube | US$0 (link manual, sem Data API) |
