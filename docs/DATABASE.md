# DATABASE — Karaokê Just Go

> PostgreSQL via Supabase. O schema é versionado em `supabase/migrations/` — o banco deve
> poder ser reconstruído inteiramente a partir das migrations, nada só pelo painel.

Projeto Supabase: `just-go-karaoke` (região `sa-east-1`).

## Convenções

- Tabelas do produto atual usam o prefixo `karaoke_`.
- Chaves primárias são `uuid` com `gen_random_uuid()`.
- Horários são `timestamptz`. A formatação para exibição acontece no cliente.
- Todas as tabelas têm RLS habilitado.

## Modelo

```
karaoke_rooms 1 ──── N karaoke_queue_entries
      │
      ├──────────── N karaoke_screen_contents
      │                      ▲
      │   screen_content_id ─┘  (conteúdo temporário no ar)
      │
      └──────────── N karaoke_advertisements
```

### `karaoke_rooms`

A sala/noite de karaokê. O estado do telão vive aqui para que todos os dispositivos
convirjam para a mesma verdade.

| Coluna              | Tipo          | Observação                                                 |
| ------------------- | ------------- | ---------------------------------------------------------- |
| `id`                | `uuid`        | PK                                                         |
| `slug`              | `text`        | Único. Identifica a implantação (`VITE_KARAOKE_ROOM_SLUG`) |
| `name`              | `text`        | Nome exibido                                               |
| `host_name`         | `text`        | Host da noite, opcional                                    |
| `screen_online`     | `boolean`     | Host pode desligar o telão                                 |
| `screen_content_id` | `uuid`        | FK. `NULL` = telão exibindo o karaokê                      |
| `screen_expires_at` | `timestamptz` | `NULL` = exibe até o Host remover                          |

### `karaoke_queue_entries`

Fila, apresentação atual e histórico são a **mesma tabela**, distinguidos por `status`. Uma
solicitação nunca muda de tabela ao longo da noite, o que torna o histórico uma consequência
e não um registro paralelo que pode divergir.

| Coluna                                                            | Tipo                   | Observação                               |
| ----------------------------------------------------------------- | ---------------------- | ---------------------------------------- |
| `room_id`                                                         | `uuid`                 | FK, `on delete cascade`                  |
| `participant`                                                     | `text`                 | 1 a 60 caracteres                        |
| `phone`                                                           | `text`                 | WhatsApp opcional                        |
| `song_title` · `song_artist` · `song_duration` · `song_thumbnail` | `text`                 | Cópia dos metadados no momento do pedido |
| `youtube_id`                                                      | `text`                 | Mídia na fonte atual                     |
| `status`                                                          | `karaoke_entry_status` | Ver abaixo                               |
| `position`                                                        | `integer`              | Ordem na fila                            |
| `requested_at` · `started_at` · `finished_at`                     | `timestamptz`          | Linha do tempo da solicitação            |

Os metadados da música são copiados de propósito. Se o vídeo sair do ar, o histórico continua
contando o que foi cantado naquela noite.

#### `karaoke_entry_status`

| Valor       | Significado                                   |
| ----------- | --------------------------------------------- |
| `pending`   | Proposta pelo participante, aguardando o Host |
| `waiting`   | Aprovada e na fila                            |
| `playing`   | Em execução                                   |
| `completed` | Apresentada                                   |
| `cancelled` | Pulada ou cancelada                           |

O status `next` **não existe no banco**. É derivado no cliente: quem tem a menor `position`
entre os `waiting` é o próximo. Persistir isso permitiria o banco discordar de si mesmo.

#### Garantias

```sql
create unique index karaoke_queue_entries_one_playing_idx
  on karaoke_queue_entries (room_id) where status = 'playing';
```

A regra "apenas uma apresentação em execução" é do banco, não da interface. O cliente já
encerra a anterior antes de iniciar a próxima, mas o índice impede que uma corrida entre dois
dispositivos do Host coloque duas músicas no ar.

### `karaoke_screen_contents`

Cada publicação no telão gera uma linha. A sala aponta para a que está no ar.

| Coluna             | Tipo                          | Observação                                  |
| ------------------ | ----------------------------- | ------------------------------------------- |
| `type`             | `karaoke_screen_content_type` | `karaoke`, `cta`, `notice`, `ad`, `qrcode`  |
| `title`            | `text`                        | Mensagem grande do telão                    |
| `body`             | `text`                        | Emoji ou texto de apoio                     |
| `image_url`        | `text`                        | Publicidade                                 |
| `duration_seconds` | `integer`                     | 1 a 3600. `NULL` = manual                   |
| `priority`         | `smallint`                    | 1 karaokê · 2 aviso · 3 CTA · 4 publicidade |

Guardar o histórico de publicações, e não só o conteúdo atual, permite saber depois quantas
vezes cada campanha foi ao ar.

### `karaoke_advertisements`

Biblioteca de campanhas do Host: título, URL da imagem e duração padrão.

## Realtime

Publicadas em `supabase_realtime`: `karaoke_rooms`, `karaoke_queue_entries` e
`karaoke_advertisements`. `karaoke_screen_contents` não precisa — o que muda é o ponteiro na
sala, e a sala já notifica.

## RLS

As quatro tabelas têm uma política `for all to anon, authenticated using (true) with check
(true)`. É uma decisão consciente e documentada, não um esquecimento: o Host entra sem senha
neste MVP, então participante e Host chegam ao banco pela mesma role `anon`. Ver
[`SECURITY.md`](./SECURITY.md) para o risco aceito e o caminho de saída.

## Schema legado

O banco ainda contém as tabelas do produto anterior (`sessions`, `performances`, `votes`,
`profiles`, `points_transactions`, `badges`, `user_badges`, `awards`, `venues`, `tenants`,
`venue_staff`, `session_participants`). **Nenhuma é lida ou escrita pelo código atual.**

Elas não foram removidas porque guardam dados reais das noites já realizadas. A remoção é uma
decisão de negócio e está preparada em
[`supabase/scripts/drop-legacy-schema.sql`](../supabase/scripts/drop-legacy-schema.sql), para
execução manual após exportar o que tiver valor histórico.

## Regenerar os tipos

```bash
npx supabase gen types typescript --project-id ghtltnxrmskllagitiap > src/lib/database.types.ts
```

`src/lib/database.types.ts` é mantido com apenas as tabelas `karaoke_*` — o restante do
schema não é consumido pela aplicação.
