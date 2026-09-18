# DEPLOYMENT — Karaokê Just Go

- **Produção:** <https://danielsmartaccess.github.io/karaokeJustGo/>
- **Backend:** projeto Supabase `just-go-karaoke` (`sa-east-1`)

## Como o deploy acontece

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em todo push e PR para `main`:

1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `npm run build` — com as variáveis injetadas dos GitHub Secrets/Variables
5. Copia `dist/index.html` para `dist/404.html` (fallback de SPA)
6. Em `main`, publica `dist/` no GitHub Pages

Não há passo manual. Merge em `main` é o deploy.

## Variáveis necessárias

Em **Settings → Secrets and variables → Actions**:

| Nome                     | Tipo     | Valor                                      |
| ------------------------ | -------- | ------------------------------------------ |
| `VITE_SUPABASE_URL`      | Secret   | `https://ghtltnxrmskllagitiap.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Secret   | Chave publicável (nunca a `service_role`)  |
| `VITE_KARAOKE_ROOM_SLUG` | Variable | `just-go`                                  |

> Se `VITE_KARAOKE_ROOM_SLUG` não estiver definida, o app usa `just-go` como padrão.
> Se as duas primeiras faltarem, o build sai em **modo demo** e nada é compartilhado entre
> dispositivos. É o sintoma a checar primeiro se a fila não aparece na TV.

## Base path

O Vite publica em `/karaokeJustGo/`, definido em [`vite.config.ts`](../vite.config.ts). O
nome precisa bater com o do repositório. Se o repositório for renomeado, atualize `BASE` no
Vite, o `href` do favicon em `index.html` e o `BASE_PATH` do
[`playwright.config.ts`](../playwright.config.ts).

O roteamento é por hash, então as rotas internas não dependem de reescrita no servidor. O
`404.html` cobre apenas um acesso direto a um caminho inexistente.

## Migrations do banco

O schema é versionado em `supabase/migrations/`. O CI **não** aplica migrations — o deploy do
frontend e a evolução do banco são passos separados, de propósito, para que uma mudança de
schema nunca entre no ar sem alguém olhar.

Para aplicar:

```bash
npx supabase link --project-ref ghtltnxrmskllagitiap
npx supabase db push
```

Ou cole o SQL no SQL Editor do projeto. Depois, regenere os tipos:

```bash
npx supabase gen types typescript --project-id ghtltnxrmskllagitiap > src/lib/database.types.ts
```

## Checklist antes de uma noite de operação

1. Abrir <https://danielsmartaccess.github.io/karaokeJustGo/#/host> e confirmar que o
   cabeçalho mostra **Ao vivo**. Se mostrar _Modo demo_, as variáveis do build estão faltando.
2. Abrir o telão na TV em `#/telao` e deixar em tela cheia.
3. Publicar o QR code no telão pela aba **Telão** do painel.
4. Escanear o QR com um celular e confirmar que a solicitação chega como pendente no painel.
5. Conferir que o telão está **ONLINE** no cartão de status.

Os passos 4 e 5 juntos provam que o realtime está funcionando entre os três dispositivos. É o
teste que vale a pena fazer antes de abrir a casa.

## Rollback

O GitHub Pages guarda o histórico de deploys. Para voltar, reverta o commit em `main` — o
workflow republica sozinho.

```bash
git revert <sha>
git push
```

Reverter o frontend **não** reverte migrations já aplicadas. Mudanças de schema precisam de
migration de compensação própria.

## Modo demo como plano B

Se o Supabase cair no meio da noite, o app continua carregando, mas sem estado compartilhado.
Não existe hoje um modo offline que sincronize depois. Na prática, a operação vira manual até
o backend voltar.
