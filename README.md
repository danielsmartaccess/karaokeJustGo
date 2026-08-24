# 🎤 Just Go Karaoke

Plataforma de **experiência social** para karaokê, desenvolvida pela **Just Go Smart Access**.
Primeiro ambiente piloto: **Armazém Anita** (Porto Alegre/RS).

> O karaokê é o contexto. A experiência social é o produto.
> _Pertencimento + Participação + Reconhecimento + Diversão._

O produto é composto por três experiências que se sincronizam em tempo real:

| Experiência     | Público        | Formato          |
| --------------- | -------------- | ---------------- |
| **Participante**| quem canta/vota| PWA mobile-first |
| **Host**        | operador       | PWA admin        |
| **Telão**       | plateia        | Web pública      |

---

## 🧱 Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite 6 + Tailwind CSS v4 + shadcn/ui + PWA
- **Backend / BaaS:** Supabase — PostgreSQL, Auth, Realtime (Presence + Broadcast), Storage, Edge Functions
- **Testes:** Vitest (unit) + Playwright (E2E)
- **CI/CD:** GitHub Actions → GitHub Pages

> Neste MVP **não** usamos Next.js nem Vercel.

---

## 📁 Estrutura

```
src/
├── app/         # rotas das 3 experiências (participant / host / display)
├── domain/      # ⭐ regras de negócio PURAS e testáveis (sem React)
│   ├── voting/          # elegibilidade, janela 60s, médias, percentuais
│   ├── performance/     # máquina de estados da apresentação
│   ├── gamification/    # XP (fama e badges nas próximas fatias)
│   └── session/         # máquina de estados da sessão (FASE 3)
├── assets/      # imagens da marca (glifo "Go" extraído do logo oficial)
├── data/        # camada Supabase — identity.ts, sessions.ts (FASE 3)
├── ui/          # design system Just Go (tokens + componentes)
├── lib/         # utilitários (cn, cliente Supabase)
└── hooks/
supabase/migrations/   # schema versionado (banco reconstruível) — FASE 2
tests/unit/  ·  tests/e2e/
docs/        # PRODUCT · ARCHITECTURE · DATABASE · SECURITY · TESTING · DEPLOYMENT
```

**Princípio central:** o domínio (`src/domain/`) é isolado do React. Fórmulas de voto, XP e
transições de estado vivem em funções puras testáveis — nunca dentro de JSX.

---

## 🚀 Começando

Pré-requisitos: **Node 22+** e **npm 10+**.

```bash
git clone https://github.com/danielsmartaccess/karaokeJustGo.git
cd karaokeJustGo
npm install
cp .env.example .env   # preencha as variáveis do Supabase (ver abaixo)
npm run dev            # http://localhost:5173/karaokeJustGo/
```

### Variáveis de ambiente

Apenas variáveis com prefixo `VITE_` são expostas ao frontend. **Nunca** coloque a
`service_role` key no frontend.

| Variável                 | Descrição                              |
| ------------------------ | -------------------------------------- |
| `VITE_SUPABASE_URL`      | URL do projeto Supabase                |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (anon/publishable)       |

`VITE_DEFAULT_VENUE_SLUG` define o venue desta implantação (ex.: `armazem-anita`) — nunca
hardcode o id do venue no código (docs/PRODUCT.md).

> Sem Supabase configurado o app roda em modo demo nas telas que ainda não dependem dele.
> A partir da FASE 3, `/join` e `/host` exigem Supabase configurado e **Anonymous Sign-ins**
> habilitado no projeto (Authentication → Sign In / Providers → Anonymous).

---

## 🧪 Scripts

| Comando             | O que faz                                    |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento                  |
| `npm run build`     | Type-check + build de produção               |
| `npm run preview`   | Serve o build localmente                     |
| `npm run lint`      | ESLint                                        |
| `npm run test`      | Testes unitários (Vitest)                    |
| `npm run test:e2e`  | Testes E2E (Playwright)                      |
| `npm run typecheck` | Verificação de tipos                          |

**Antes de considerar qualquer feature pronta** (seção 45 do prompt mestre):

```bash
npm run lint && npm run test && npm run build
```

---

## 🚢 Deploy

`git push` na branch `main` dispara o GitHub Actions que executa **lint → test → build →
deploy no GitHub Pages**. O build não publica se lint/testes/build falharem.

- Base path configurado: `/karaokeJustGo/` (`vite.config.ts`)
- SPA fallback: `404.html` gerado no deploy (rotas do React Router funcionam em deep-links)
- Secrets do Pages: configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no repositório

Detalhes em [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 🗺️ Roadmap (fatias verticais)

| Fase | Entrega                                             | Status |
| ---- | --------------------------------------------------- | ------ |
| 0    | Diagnóstico                                         | ✅     |
| 1    | Foundation (scaffold, domínio, CI, Pages)           | ✅     |
| 2    | Supabase (migrations, schema, RLS, Auth, seed)      | ✅     |
| 3    | Sessão (venue, session, código/QR, cadastro mínimo) | ✅     |
| 4    | Músicas (catálogo, busca, favoritos)                | ✅     |
| 5    | Fila (entrar/sair, fila do host)                    | ✅     |
| 6    | Apresentação (chamar/cantar, telão, Realtime)       | ✅     |
| 7    | Votação (janela 60s, categorias, resultado)         | ⏳     |
| 8    | Gamificação (XP, fama, badges, ranking)             | ⏳     |
| 9    | Premiação (Performance da Noite, prêmio)            | ⏳     |
| 10   | Polimento · 11 E2E · 12 Deploy                       | ⏳     |

---

## 📚 Documentação

[PRODUCT](docs/PRODUCT.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [DATABASE](docs/DATABASE.md) ·
[SECURITY](docs/SECURITY.md) · [TESTING](docs/TESTING.md) · [DEPLOYMENT](docs/DEPLOYMENT.md)

---

© Just Go Smart Access — todos os direitos reservados.
