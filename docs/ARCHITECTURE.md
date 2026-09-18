# ARCHITECTURE — Karaokê Just Go

## Visão geral

Três dispositivos, um estado. O celular do participante, o notebook do Host e a TV do bar
abrem a mesma aplicação em rotas diferentes e convergem pelo Supabase Realtime.

```
   CELULAR              NOTEBOOK              TV / PROJETOR
  #/ participante       #/host                #/telao
        |                   |                      |
        +---------+---------+----------+-----------+
                            |
                   React (Vite + Tailwind v4)
                            |
                   store/KaraokeContext
                   (reducer + otimismo local)
                            |
                 services/karaokeRepository
                            |
                    Supabase (PostgREST + Realtime)
                            |
                        PostgreSQL
```

## Camadas

| Camada      | Onde              | Responsabilidade                                                 |
| ----------- | ----------------- | ---------------------------------------------------------------- |
| Views       | `src/views/`      | Uma tela por experiência. Só renderizam e disparam ações         |
| Componentes | `src/components/` | Peças reutilizáveis. Sem regra de negócio                        |
| Estado      | `src/store/`      | Reducer puro com as regras + provider que sincroniza             |
| Serviços    | `src/services/`   | Supabase e busca no YouTube. Única fronteira com o mundo externo |
| Infra       | `src/lib/`        | Cliente Supabase, tipos do banco, rotas                          |
| Tipos       | `src/types/`      | Modelo de domínio compartilhado                                  |

A regra que sustenta o desenho: **componente visual não conhece o Supabase**. Ele despacha
uma ação; quem decide se aquilo vira uma linha no Postgres é o provider.

## Fluxo de uma ação

Quando o Host clica em "Iniciar":

1. A view despacha `{ type: 'START_PLAYING', entryId }`.
2. O reducer aplica a mudança **na hora**, sem esperar a rede. O painel responde instantâneo.
3. O provider chama `applyAction`, que traduz a ação em escritas no Postgres.
4. O Realtime avisa todos os dispositivos da sala.
5. Cada um recarrega o snapshot e despacha `HYDRATE`, que substitui o estado local pelo do
   servidor.

O passo 2 é otimismo local; o passo 5 é a correção autoritativa. Se a escrita falhar, o
próximo `HYDRATE` desfaz a mudança otimista — o servidor sempre vence.

### Fila de saída

Ações disparadas antes de a sala resolver ficam num _outbox_ em memória e são reenviadas em
ordem assim que a conexão abre. Sem isso, o participante que escaneia o QR e digita rápido
perderia a solicitação: ela apareceria na tela dele e sumiria no primeiro `HYDRATE`.

## Dois modos de operação

| Modo        | Condição                         | Comportamento                                        |
| ----------- | -------------------------------- | ---------------------------------------------------- |
| **Ao vivo** | `VITE_SUPABASE_URL` + `ANON_KEY` | Estado compartilhado entre dispositivos via Realtime |
| **Demo**    | Variáveis ausentes               | Estado só na memória da aba, com dados mockados      |

O modo demo não é um fallback degradado por acidente: é o modo de aula e de desenvolvimento
offline. `src/data/mockData.ts` traz catálogo, fila inicial, histórico, CTAs, avisos e
publicidades de exemplo.

O status aparece no cabeçalho do Host: _Ao vivo_, _Conectando…_, _Modo demo_ ou _Sem conexão_.

## Roteamento

Hash routing (`#/`, `#/telao`, `#/host`), sem biblioteca. A escolha é consequência do deploy:
o GitHub Pages serve o app sob `/karaokeJustGo/` e não faz reescrita de caminho. Com hash, a
TV abre direto no telão e o Host direto no painel, sem configuração de servidor.

`participantUrl()` em `src/lib/urls.ts` monta o endereço do QR code. O QR sempre aponta para a
tela do participante, nunca para a aba em que o Host está.

## O relógio do telão

Conteúdo temporário guarda o instante de expiração (`expiresAt`), não um contador. Cada
dispositivo calcula os segundos restantes a partir do próprio relógio e do mesmo
`screen_expires_at` vindo do banco. Quando o prazo vence, todos voltam ao karaokê sozinhos,
sem ninguém precisar escrever "acabou" no banco.

## Chamada pelo WhatsApp

`src/lib/whatsapp.ts` monta um link `wa.me` com o telefone normalizado e a mensagem
codificada. O clique abre o WhatsApp Web no desktop ou o aplicativo no celular, com a conversa
pronta.

Não é push de verdade, e a escolha é deliberada: push real exigiria a WhatsApp Business API,
com cadastro de empresa, template aprovado e custo por mensagem. Para avisar quatro pessoas
por noite, o custo de montagem não se paga.

O preço dessa escolha é que o envio depende do Host apertar enviar. Por isso a ação carimba
`notified_at` no banco em vez de fingir que a mensagem saiu: numa casa cheia, com o Host
alternando entre notebook e tablet, o botão precisa contar quem já foi chamado.

A normalização recusa o que não parece telefone brasileiro em vez de tentar adivinhar. Abrir
conversa com o número errado é pior do que não oferecer o botão.

## Catálogo de karaokê

`src/data/karaokeCatalog.ts` é **gerado**, não escrito à mão, por
`scripts/gen-karaoke-catalog.mjs`. O script busca a versão karaokê de cada música de uma
curadoria, e para cada candidato confere duas coisas: que o vídeo existe e é público (oEmbed) e
que ele toca embutido (a página `/embed`, o mesmo caminho que o telão usa).

A segunda checagem é a que importa. O oEmbed responde 200 até para vídeo que bloqueia
incorporação, então validar só por ele deixaria passar vídeo que aparece na lista e falha na
TV.

Regerar antes de um evento é barato e evita a falha mais constrangedora possível: o
participante escolhe, o telão abre e o vídeo não existe mais.

## Decisões e trocas

- **Reducer puro separado do provider.** `src/store/reducer.ts` não importa React. É onde as
  regras de negócio vivem e onde os testes batem.
- **Sem `react-router`.** Três rotas fixas não justificam a dependência.
- **Status `next` derivado, não persistido.** Quem é o próximo é sempre o primeiro da fila.
  Persistir esse status abriria espaço para o banco discordar de si mesmo.
- **Snapshot inteiro a cada mudança.** Mais simples e previsível que aplicar deltas do
  Realtime. Para a escala de uma noite de bar, o custo é irrelevante.
- **Escrita anônima no banco.** Consequência do Host sem senha. Ver [`SECURITY.md`](./SECURITY.md).
- **Catálogo gerado, não curado à mão.** Uma lista fixa de ids de vídeo apodrece sem avisar.
- **WhatsApp por link, não por API.** Ver acima.

## Estrutura de arquivos

```
src/
  App.tsx                      rotas e navegação
  main.tsx                     ponto de entrada
  index.css                    design system (Tailwind v4)
  components/
    Logo.tsx                   marca oficial, servida de public/
    SearchBar · SongCard · HistoryTable · EmptyState · ErrorMessage · QRCodeDisplay
    ui/                        Button · Badge · Modal
  data/
    karaokeCatalog.ts          GERADO — catálogo verificado de karaokê
    mockData.ts                fila e presets do modo demo
  lib/
    supabase.ts                cliente e detecção de modo
    database.types.ts          tipos gerados do schema
    urls.ts                    rotas e URL do QR code
    whatsapp.ts                link de chamada do próximo cantor
  services/
    karaokeRepository.ts       Postgres <-> domínio + realtime
    youtubeSearch.ts           YouTube Data API com fallback local
  store/
    actions.ts                 vocabulário de ações
    reducer.ts                 regras de negócio (função pura)
    KaraokeContext.tsx         provider, sincronização e outbox
  types/index.ts               modelo de domínio
  views/
    ParticipantView · TVQueueView · HostView · HostLogin
```
