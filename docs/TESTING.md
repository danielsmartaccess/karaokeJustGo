# TESTING — Just Go Karaoke

## Ferramentas

- **Vitest** — testes unitários (domínio) e de componente (jsdom + Testing Library).
- **Playwright** — E2E (Chromium + perfil mobile).

## Comandos

```bash
npm run test        # unit (Vitest, uma passada)
npm run test:watch  # unit em watch
npm run test:e2e    # E2E (Playwright) — builda e serve o preview automaticamente
```

## Cobertura atual (FASE 1) — 25 testes

- **Máquina de estados da apresentação** — fluxo feliz, transições inválidas, cancelamento,
  estados terminais.
- **Regras de votação** — elegibilidade (auto-voto, ausente, duplicado, janela 60s, limites),
  validação de notas, cálculo de resultado (médias, %, Nota da Plateia).
- **XP** — defaults e tabela configurável.
- **E2E smoke** — home do participante carrega e navega.

## Alvos por fatia (seção 43)

**Unitários:** cálculo de notas · elegibilidade · janela de votação · XP · fama · badges ·
ranking · Performance da Noite · transições de estado.

**Integração:** criação de sessão · entrada · fila · apresentação · votação · resultado ·
pontuação.

**E2E (fluxos críticos):**

1. QR → cadastro → sessão
2. busca → música → fila
3. HOST → chamada → apresentação
4. apresentação → votação 60s → resultado
5. resultado → XP → ranking
6. votar duas vezes (bloqueado)
7. votar na própria apresentação (bloqueado)
8. votar após 60s (bloqueado)
9. participante tentando acessar HOST (bloqueado)

## Regra

Nunca afirmar que algo foi testado sem executar `npm run lint && npm run test && npm run build`
(e `npm run test:e2e` quando aplicável).

## Protocolo de teste manual ao vivo

Enquanto as fatias 10/11 (Playwright cobrindo os fluxos críticos acima) não existem, a
validação de ponta a ponta é manual, com o Supabase remoto real — é assim que os bugs das
FASES 6–9 foram achados (ver "testado ao vivo" em ARCHITECTURE.md/DATABASE.md). Este protocolo
cobre o fluxo completo participante → host → telão, incluindo Performance da Noite (FASE 9).

### 0. Preparar o banco

Dados fixos (tenant, venue, badges) e o papel HOST/ADMIN já existente ficam; só o ciclo de
uma sessão (sessions/performances/votes/XP/badges concedidos/awards) precisa zerar entre
rodadas (não há mais catálogo de músicas desde a FASE 10 — o pedido é texto livre na
própria `performances`):

```sql
-- supabase/reset-test-round.sql — rodar no SQL Editor do Supabase
truncate table public.sessions cascade;
```

### 1. Papéis e navegadores

Cada identidade de participante = uma sessão anônima do Supabase Auth persistida em
`localStorage` (`src/lib/active-session.ts`). Para ter identidades distintas ao mesmo tempo,
use **navegadores/perfis diferentes** (não basta abrir várias abas do mesmo navegador — elas
compartilham o mesmo `localStorage`):

| Papel                      | Onde                                                        |
| -------------------------- | ----------------------------------------------------------- |
| **HOST**                   | Seu navegador principal (já tem `ADMIN` em Armazém Anita)   |
| **TELÃO**                  | Uma aba qualquer — rota pública, sem login                  |
| **PARTICIPANTE A** (canta) | Janela anônima/privada do navegador 2                       |
| **PARTICIPANTE B** (vota)  | Navegador 3 (ou outro perfil/janela anônima do navegador 2) |

Mínimo de 2 participantes além do host: quem canta não pode votar em si (`isPresent`/
auto-voto bloqueado em `domain/voting/rules.ts`), então validar a agregação de nota exige
pelo menos 1 votante além do performer.

URLs (dev, `npm run dev`, base `/karaokeJustGo/`):

- Host: `http://localhost:5173/karaokeJustGo/host`
- Entrar: `http://localhost:5173/karaokeJustGo/join`
- Telão: `http://localhost:5173/karaokeJustGo/display`

### 2. Passo a passo

1. **HOST** abre `/host` → `+ Nova sessão` → copia o código de 6 dígitos → `Abrir`.
2. **TELÃO** abre `/display`, digita o código (ou usa o link "telão" do painel do host) →
   confirma que mostra a sessão aberta.
3. **PARTICIPANTE A** abre `/join`, digita o código → preenche nome + WhatsApp → `Entrar`.
4. **PARTICIPANTE B** repete o passo 3 em outro navegador, com nome diferente.
5. Cada participante vai em `/songs` ("Pedir música"), digita o nome da música em texto
   livre → `Entrar na fila` (confirma em `/queue` que aparece, com posição).
6. **HOST**: `Ao vivo` na sessão → `Chamar próximo` → confirma que o Participante A chamado
   aparece no painel e some da fila.
7. **HOST**: cola um link do YouTube no campo "Vídeo do YouTube" do card do chamado (use o
   atalho "buscar … karaokê ↗" pra achar) → `Começou a cantar` → checa que o **TELÃO**
   sobe o `<iframe>` do vídeo e que `/queue` do Participante A reflete "cantando agora" via
   Realtime (sem reload). Sem link, o telão cai no fallback de texto.
7b. **HOST** (opcional, "modo DJ"): na seção "🎧 Tocar agora", cola um link do YouTube →
    `Tocar no telão` → confirma que o **TELÃO** toca o vídeo enquanto ninguém canta e que
    `Parar` volta pro estado de espera.
8. **HOST**: `Iniciar votação` → **Participante B** (não A) vai em `/vote`, avalia as 4
   categorias (Voz/Performance/Carisma/Diversão, 1–5) + "eu cantaria junto" → `Votar`.
   Confirma que **Participante A** vê "Você está sendo avaliado" (sem poder votar) e que o
   contador de 60s aparece para o B.
9. Deixa o timer zerar (ou **HOST** clica `Encerrar votação agora`) → confirma que
   Nota da Plateia aparece para B, no telão e (após `Concluir`) no host.
10. Repete os passos 6–9 para o Participante B cantar e A votar — precisa de **2
    apresentações completas** para a Performance da Noite ter o que comparar.
11. **HOST**: `Encerrar` a sessão (`CLOSED`) → confirma que **TELÃO** (visitante anônimo, sem
    login) continua mostrando a sessão em vez de "não encontrada" (bug da FASE 9 já
    corrigido — é exatamente o que essa etapa revalida).
12. **HOST**: `🏆 Anunciar Performance da Noite` → confirma que aparece no painel do host, no
    telão (nome em destaque) e em `/queue` de ambos os participantes (banner 🏆), a maior
    Nota da Plateia entre as duas apresentações.
13. **AMBOS os participantes** conferem `/profile`: XP acumulado (entrar, cantar, votar)
    bate com `src/domain/gamification/xp.ts`, e os badges esperados apareceram (ex.:
    "Primeiro Passo").

### 3. Casos negativos (bloquear, não só o caminho feliz)

- [ ] Participante tenta abrir `/host` sem `venue_staff` → tela "Sem permissão de host".
- [ ] Participante B tenta votar de novo na mesma apresentação → rejeitado
      (`unique(performance_id, voter_id)` + trigger).
- [ ] Participante A tenta votar na própria apresentação → bloqueado na UI
      (`performance.isMine`) e pelo trigger `validate_vote` se forçado via API.
- [ ] Voto após os 60s (`voting_started_at` + `VOTING_WINDOW_SECONDS`) → rejeitado.
- [ ] `Anunciar Performance da Noite` antes de `CLOSED` → RPC recusa (checa dentro da
      function, não só RLS).
- [ ] Clicar `Anunciar Performance da Noite` duas vezes → idempotente, não duplica o award
      nem re-concede o badge `performance-da-noite`.

### 4. Depois do teste

Se achar um bug real (como nas FASES 6–9), registrar em ARCHITECTURE.md/DATABASE.md na seção
da fase, no mesmo formato "Bug corrigido nesta fase" já usado — não só corrigir silenciosamente.
