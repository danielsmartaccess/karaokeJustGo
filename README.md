# 🎤 Karaokê Just Go

Plataforma de entretenimento para bares, da **Just Go Smart Access**.

Não é um tocador de músicas com fila. O telão vira canal de comunicação entre a casa e o
público, e o Host comanda a noite inteira de um painel só.

**Produção:** <https://danielsmartaccess.github.io/karaokeJustGo/>

## As três telas

| Quem             | Rota      | O que faz                                                               |
| ---------------- | --------- | ----------------------------------------------------------------------- |
| **Participante** | `#/`      | Escolhe no catálogo ou busca, informa o nome e pede para entrar na fila |
| **Modo Palco**   | `#/telao` | Apresentação, chamadas, avisos, publicidade e QR code de entrada        |
| **Host**         | `#/host`  | Aprova a fila, chama o próximo pelo WhatsApp e comanda o telão          |

As três abrem a mesma aplicação em dispositivos diferentes e compartilham o mesmo estado via
Supabase Realtime.

## Começando

```bash
npm install
cp .env.example .env    # preencha as variáveis do Supabase
npm run dev
```

Sem as variáveis do Supabase o app roda em **modo demo**: estado só na memória da aba, com
dados de demonstração. Serve para aula e desenvolvimento offline — mas nada é compartilhado
entre dispositivos.

### Variáveis

| Variável                 | Obrigatória | Para quê                                       |
| ------------------------ | ----------- | ---------------------------------------------- |
| `VITE_SUPABASE_URL`      | Sim\*       | Backend                                        |
| `VITE_SUPABASE_ANON_KEY` | Sim\*       | Chave publicável, nunca a `service_role`       |
| `VITE_KARAOKE_ROOM_SLUG` | Não         | Sala desta implantação. Padrão `just-go`       |
| `VITE_YOUTUBE_API_KEY`   | Não         | Busca real no YouTube; sem ela, catálogo local |

\* Ausentes, o app cai em modo demo em vez de falhar.

## Catálogo de karaokê

A tela do participante abre com 34 músicas das mais pedidas em karaokê, filtráveis por gênero.
O catálogo é **gerado**, não escrito à mão:

```bash
node scripts/gen-karaoke-catalog.mjs         # regera src/data/karaokeCatalog.ts
node scripts/gen-karaoke-catalog.mjs --dry   # só confere, sem escrever
```

Cada vídeo é conferido na geração: existe, é público e toca embutido. Vídeo de karaokê sai do
ar, então vale regerar antes de um evento.

## Comandos

```bash
npm run dev         # servidor de desenvolvimento
npm run build       # typecheck + build de produção
npm run preview     # serve o build local
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run test        # testes unitários (Vitest)
npm run test:e2e    # E2E (Playwright)
npm run format      # Prettier
```

> `npm run test:e2e` roda contra o build. Se o `.env` tiver Supabase, os testes **escrevem no
> banco real**. Ver [`docs/TESTING.md`](docs/TESTING.md).

Para verificar a sincronia entre os três dispositivos ao mesmo tempo, antes de um evento:

```bash
npm run build && npm run preview     # num terminal
node scripts/verifica-sincronia.mjs  # noutro
```

## Stack

React 18 · TypeScript · Vite 6 · Tailwind CSS v4 · Supabase (PostgreSQL + Realtime) ·
lucide-react · qrcode.react · PWA · GitHub Pages

## Como o estado funciona

Componente despacha uma ação → o reducer aplica na hora (a interface responde sem esperar a
rede) → o repositório persiste no Postgres → o Realtime avisa todos os dispositivos → cada um
recarrega o snapshot.

O reducer é uma função pura em [`src/store/reducer.ts`](src/store/reducer.ts). É onde vivem as
regras de negócio e onde os testes batem. Componente visual não conhece o Supabase.

## Documentação

| Documento                            | Assunto                                          |
| ------------------------------------ | ------------------------------------------------ |
| [PRODUCT](docs/PRODUCT.md)           | Visão, atores, regras de negócio, estados        |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Camadas, fluxo de ação, decisões e trocas        |
| [DATABASE](docs/DATABASE.md)         | Schema, enums, RLS, realtime, legado             |
| [SECURITY](docs/SECURITY.md)         | Host sem senha, riscos aceitos, caminho de saída |
| [TESTING](docs/TESTING.md)           | O que é testado e por quê                        |
| [DEPLOYMENT](docs/DEPLOYMENT.md)     | CI, variáveis, migrations, checklist da noite    |

## Estado do projeto

MVP em produção. O Host entra **sem senha** por decisão de produto, e o banco aceita escrita
anônima como consequência. Leia [`docs/SECURITY.md`](docs/SECURITY.md) antes de abrir o
produto para mais de um estabelecimento.

O banco ainda guarda as tabelas do produto anterior (sessões, votação, gamificação), sem uso
pelo código atual. A remoção está preparada em
[`supabase/scripts/drop-legacy-schema.sql`](supabase/scripts/drop-legacy-schema.sql) e é
manual, porque há dados reais lá.

---

© Just Go Smart Access
