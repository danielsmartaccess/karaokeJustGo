# VERCEL — preparação da migração de hospedagem

> **Estado:** o código está preparado, **nada foi publicado**. O GitHub Pages continua sendo a
> produção até a migração ser autorizada. Este documento é o plano e a referência de
> configuração para essa etapa. O processo atual de deploy está em
> [`DEPLOYMENT.md`](./DEPLOYMENT.md) e continua válido.

## Por que migrar

O GitHub Pages só publica repositório **público** no plano gratuito. Para tornar o repositório
privado sem tirar o app do ar, a hospedagem precisa sair do Pages. O backend (Supabase) não
muda; só o frontend estático muda de endereço.

## O que mudou no código para isso

| Arquivo                | Mudança                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `vite.config.ts`       | `base` deixa de ser fixo: `BASE_PATH` → `/` se `VERCEL` → `/karaokeJustGo/` (padrão) |
| `index.html`           | Favicon sem caminho fixo (`/favicon.svg`); o Vite aplica o `base` sozinho            |
| `playwright.config.ts` | Lê `BASE_PATH`, para rodar o E2E como a Vercel serve (raiz do domínio)               |
| `package.json`         | `engines.node = 22.x`: a Vercel usa 24.x por padrão, enquanto CI e local usam 22     |
| `.env.example`         | Documenta `BASE_PATH` e o risco da chave do YouTube no bundle                        |

O build padrão (GitHub Pages) continua **byte a byte idêntico** ao anterior.

## Configuração do projeto na Vercel

| Parâmetro        | Valor                    | Observação                                        |
| ---------------- | ------------------------ | ------------------------------------------------- |
| Framework Preset | Vite                     | Detectado sozinho                                 |
| Root Directory   | `.` (raiz)               | Não é monorepo                                    |
| Install Command  | padrão (`npm install`)   | A Vercel detecta o `package-lock.json`            |
| Build Command    | padrão (`npm run build`) | `tsc -b && vite build`                            |
| Output Directory | padrão (`dist`)          | Detectado pelo preset                             |
| Node.js          | 22.x                     | Fixado por `engines`; confira em Settings → Build |
| `vercel.json`    | **não necessário**       | Ver abaixo                                        |

### Por que não há `vercel.json`

- O preset do Vite já resolve instalação, build e saída.
- A documentação da Vercel só exige o rewrite `/(.*) → /index.html` para SPAs com **deep link
  por caminho** (`/host`). Aqui as rotas são por hash (`#/`, `#/telao`, `#/host`): o servidor
  sempre recebe `/`, então nenhuma reescrita é necessária.
- O `404.html` que o CI cria é só um paliativo do GitHub Pages; na Vercel não tem função.

Reavalie se um dia houver rotas por caminho, ou cabeçalhos próprios (ver "Áudio" abaixo).

## Base path

Na Vercel o app vive na raiz do domínio, então o `base` precisa ser `/`. Sem isso, JS, CSS e
manifest apontariam para `/karaokeJustGo/...` e dariam 404 (tela em branco).

Defina **explicitamente** `BASE_PATH=/` nas variáveis do projeto. A detecção por `VERCEL` é um
reforço, mas ela só existe se a opção _Enable access to System Environment Variables_ estiver
marcada no projeto, e isso não deve ser presumido.

> **Windows / Git Bash:** `BASE_PATH=/ npm run build` é reescrito pelo shell para
> `C:/Program Files/Git/`, e o build recusa o valor com a mensagem "BASE_PATH inválida". Use
> PowerShell (`$env:BASE_PATH='/'; npm run build`) ou
> `MSYS2_ENV_CONV_EXCL=BASE_PATH BASE_PATH=/ npm run build`. Na Vercel (Linux) isso não ocorre.

## Variáveis de ambiente

Toda variável `VITE_*` é **embutida no bundle público** em tempo de build. Mudar o valor exige
um novo deploy. Nenhuma delas é segredo.

| Nome                     | Classe         | Obrigatória | Escopo sugerido na Vercel | Observação                                              |
| ------------------------ | -------------- | ----------- | ------------------------- | ------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Pública        | Sim         | Production (Preview: ver) | Sem ela o app sobe em **modo demo**                     |
| `VITE_SUPABASE_ANON_KEY` | Pública        | Sim         | Production (Preview: ver) | Chave `anon`/publicável; a proteção real é o RLS        |
| `VITE_KARAOKE_ROOM_SLUG` | Pública        | Não         | Production                | Padrão `just-go`. **Typo cria uma sala nova e vazia**   |
| `VITE_YOUTUBE_API_KEY`   | Pública\*      | Não         | Production                | Hoje **não** é passada pelo CI; produção usa o catálogo |
| `BASE_PATH`              | Build, pública | Recomendada | Todos                     | Valor: `/`                                              |

\* A chave do YouTube vira pública ao entrar no bundle. Se for habilitada, restrinja-a no
Google Cloud por referenciador HTTP (incluindo o domínio da Vercel) e somente à YouTube Data
API v3.

**Segredos que nunca podem ir ao navegador nem a variáveis `VITE_*`:** `service_role` do
Supabase, senha do banco, tokens de acesso do Supabase e do GitHub. O app não precisa de
nenhum deles em runtime, pois não tem servidor. Não cadastre nenhum na Vercel.

`VITE_DEFAULT_VENUE_SLUG`, usada em `.github/workflows/ci.yml`, **não é lida pelo código**
(o app lê `VITE_KARAOKE_ROOM_SLUG`). Não a replique na Vercel.

## Preview, proteção e Supabase

- **Proteção.** Com a _Standard Protection_, os previews exigem login na Vercel; só os domínios
  de produção são públicos. Um preview não abre no celular de um participante nem na TV sem
  login ou sem um link de compartilhamento/bypass configurado pelo dono da conta.
- **Preview escreve em produção.** O app tem **uma sala compartilhada** e o RLS aceita escrita
  anônima. Um preview com as chaves de produção grava na fila real. Por padrão, **não** atribua
  `VITE_SUPABASE_*` ao escopo Preview: o preview sobe em modo demo, sem tocar no banco.
- **Validar o Supabase num preview** exige uma decisão do dono: (a) fazer o teste numa janela
  sem operação e limpar depois, ou (b) usar um slug de teste. A opção (b) faz o app **criar a
  sala sozinho** na primeira carga (`karaokeRepository.ts`), ou seja, uma escrita no banco
  remoto, que só deve ocorrer com autorização.
- **Supabase não precisa de ajuste para o novo domínio.** O app não usa Supabase Auth (não há
  fluxo de login nem redirect), então não há lista de URLs de redirecionamento a atualizar.

## PWA e troca de endereço

- O service worker é por origem. O da Vercel convive com o do `github.io` sem conflito.
- O manifest deriva `scope` e `start_url` do `base`, então fica correto em `/`.
- **Quem instalou o app a partir do `github.io` continua nele.** Instalação de PWA não migra
  entre origens.
- `localStorage` também é por origem: o Host precisa digitar o nome de novo, e participantes
  com solicitação em andamento perdem o ticket local. **Troque de endereço fora do horário de
  operação.**
- O QR code do telão é montado com o endereço aberto (`participantUrl()`). Ele aponta para a
  origem em que o telão foi aberto. Depois da troca, abra o telão e o Host **no endereço novo**.
- As duas origens compartilham o mesmo Supabase e a mesma sala, então **interoperam** durante a
  transição: um participante no endereço antigo aparece no telão do novo.

## Plano de publicação

Etapas marcadas com 🔑 exigem o proprietário da conta (login, autorização ou decisão).

1. 🔑 Decidir o plano da Vercel. O **Hobby é restrito a uso não comercial**, e este produto é
   comercial (Just Go Smart Access; consultor remunerado). Em princípio exige **Pro** — confirme
   preço e termos atuais com a Vercel.
2. 🔑 Entrar na Vercel e instalar o app da Vercel no GitHub com acesso a este repositório.
3. 🔑 Importar o repositório. Confirmar preset Vite, raiz `.`, Node 22.x.
4. 🔑 Cadastrar as variáveis da tabela acima (Production), incluindo `BASE_PATH=/`. Não
   atribuir `VITE_SUPABASE_*` a Preview sem a decisão descrita acima.
5. Gerar o primeiro deploy de **preview** (branch ou PR). O site atual não é afetado.
6. 🔑 Abrir o preview (logado, ou com link de compartilhamento). Conferir: sem 404 em
   `/assets/*`, `/manifest.webmanifest`, `/sw.js`; console sem erros.
7. Testar as três telas: participante (`#/`), telão (`#/telao`), Host (`#/host`).
8. Validar o Supabase (cabeçalho do Host em **Ao vivo**; solicitação do celular chega como
   pendente; telão **ONLINE**), conforme a decisão sobre sala de teste.
9. Validar PWA: instalar, recarregar, publicar uma nova versão e confirmar a atualização
   automática (`registerType: autoUpdate`).
10. Conferir os logs de build e de runtime na Vercel.
11. 🔑 Promover para produção (merge em `main` ou promoção manual).
12. Abrir o endereço de produção novo e repetir o checklist de `DEPLOYMENT.md`.
13. 🔑 Definir o domínio definitivo, se houver, e **reemitir materiais com QR/links impressos**.
14. 🔑 Somente depois de todos os aparelhos e materiais usarem o endereço novo, avaliar tornar o
    repositório privado. Nesse momento o Pages é despublicado (plano gratuito) e o job `deploy`
    do `ci.yml` passa a falhar; separe-o ou desative-o nessa etapa.

Enquanto os passos 1–13 não terminarem, **não** altere a visibilidade do repositório.

## Reversão

- **Antes do passo 11:** nada em produção mudou. Basta descartar o preview.
- **Depois do passo 11:** o `github.io` continua no ar (o repositório segue público e o
  workflow segue ativo), então voltar é apontar os aparelhos para o endereço antigo. Como as
  duas origens compartilham o Supabase, não há dado a reconciliar.
- **Na Vercel:** deploys anteriores ficam guardados e podem ser promovidos de volta pelo painel.
  Limites por plano não foram verificados.
- Reverter o frontend **não** reverte migrations do banco (ver `DEPLOYMENT.md`).
- Este plano não altera o banco, então não há migration a compensar.

## Segurança: o que a migração não resolve

Todos os itens abaixo já constam em [`SECURITY.md`](./SECURITY.md) e **existem igualmente no
GitHub Pages**. Mudar de hospedagem ou tornar o repositório privado não os corrige:

- **Host sem autenticação.** `#/host` só pede um nome, guardado em `localStorage`.
- **RLS permissivo** (`using (true)`) em `karaoke_*` para `anon`: qualquer pessoa com a chave
  pública, que está no bundle, lê e escreve na fila, no telão e na publicidade.
- **Telefone legível por qualquer um** via API (dado pessoal sob a LGPD, sem expurgo).
- **URL de imagem arbitrária** renderizada no telão.
- **Tornar o repositório privado não esconde a chave `anon`**: ela continua no JavaScript
  servido. O que protege os dados é o RLS, que hoje está aberto.

Nenhuma política do Supabase foi alterada. A correção é o caminho de Supabase Auth descrito em
`SECURITY.md` e exige decisão de produto.

Também existem, no esquema do banco versionado, tabelas de um modelo anterior (`sessions`,
`performances`, `votes` etc.) com políticas próprias. Se ainda existirem no projeto remoto,
vale revisá-las; isso não foi verificado, pois exigiria acesso ao Supabase remoto.

## Áudio no futuro

- **No navegador** (Web Audio, AudioWorklet, WebAssembly): funciona em hospedagem estática.
  O microfone exige HTTPS, que a Vercel fornece.
- **WebAssembly com threads** (`SharedArrayBuffer`) exige `Cross-Origin-Opener-Policy` e
  `Cross-Origin-Embedder-Policy`. Isso demandaria um `vercel.json` com cabeçalhos e pode
  **quebrar os vídeos embutidos do YouTube**; é decisão de arquitetura a avaliar antes.
- **No servidor:** Vercel Functions não são adequadas para processamento pesado e demorado de
  áudio (limites de tamanho de requisição, duração e binários). Para isso, planeje um serviço
  à parte (por exemplo FastAPI no Google Cloud), mantendo a Vercel só no frontend.
- Processar o áudio de vídeos do YouTube tem implicações de direitos autorais e de termos de
  uso que devem ser analisadas antes de qualquer implementação.

## Divergências preexistentes (não alteradas)

- `ci.yml` passa `VITE_DEFAULT_VENUE_SLUG`, mas o código lê `VITE_KARAOKE_ROOM_SLUG`. Hoje não
  causa dano porque o padrão do código é `just-go`.
- O teste E2E "host alcança a fila e vê o estado vazio" falha em modo demo, porque o estado
  demo já vem com fila. Ele pressupõe uma sala real e vazia.
- O manifest sai com `lang: "en"`, apesar de o app ser `pt-BR`.
