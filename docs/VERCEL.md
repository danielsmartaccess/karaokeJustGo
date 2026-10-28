# VERCEL — preparação da migração de hospedagem

> **Estado:** o código está preparado, **nada foi publicado**. O GitHub Pages continua sendo a
> produção até a migração ser autorizada. Este documento é o plano e a referência de
> configuração para essa etapa. O processo atual de deploy está em
> [`DEPLOYMENT.md`](./DEPLOYMENT.md) e continua válido.

## Por que migrar

Segundo a documentação do GitHub, em contas **GitHub Free** (pessoais ou de organização) o
repositório de um site do Pages precisa ser público, e tornar privado um repositório dessas
contas despublica automaticamente o site. A documentação consultada não detalha o comportamento
dos planos pagos; informa apenas que um site do Pages pode continuar acessível publicamente
mesmo com o repositório privado, e que restringir o acesso ao site exige GitHub Enterprise
Cloud. Fontes na seção "Fontes oficiais consultadas".

Portanto, se esta conta estiver no plano Free, tornar o repositório privado exige tirar a
hospedagem do Pages. **Não confirmado:** o plano desta conta (a consulta feita não o informou)
e o efeito na prática, que não foi testado, pois exigiria alterar a visibilidade do
repositório. Por isso, **mantenha o repositório público** até a migração ser validada. O
backend (Supabase) não muda; só o frontend estático muda de endereço.

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

1. 🔑 Decidir o plano da Vercel. O plano **Hobby é restrito a uso pessoal não comercial**;
   qualquer uso comercial exige Pro ou Enterprise. A Vercel considera comercial a implantação
   usada para ganho financeiro de qualquer pessoa envolvida na produção do projeto, inclusive
   quem é remunerado para desenvolvê-lo ou hospedá-lo (fonte:
   [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines), verificada em
   2026-10-28). Enquadrar este projeto é decisão do proprietário; em caso de dúvida, consulte o
   suporte da Vercel e confirme preço e termos atuais do Pro.
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
11. 🔑 Promover para produção (merge em `main` ou promoção manual). Promover um preview refaz o
    build e usa as variáveis do escopo Production, nunca as de Preview.
12. Abrir o endereço de produção novo e repetir o checklist de `DEPLOYMENT.md`.
13. 🔑 Definir o domínio definitivo, se houver, e **reemitir materiais com QR/links impressos**.
14. 🔑 Somente depois de todos os aparelhos e materiais usarem o endereço novo, avaliar tornar o
    repositório privado. Em conta GitHub Free, a documentação do GitHub informa que o site do
    Pages é despublicado automaticamente nesse momento (efeito não testado aqui). O job
    `deploy` do `ci.yml` perderia o destino de publicação (inferência, não verificada);
    separe-o ou desative-o nessa etapa.

Enquanto os passos 1–13 não terminarem, **não** altere a visibilidade do repositório.

## Reversão

Fontes: [Instant Rollback](https://vercel.com/docs/instant-rollback) e
[Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment),
verificadas em 2026-10-28. Nenhum rollback foi executado.

- **Antes do passo 11:** nada em produção mudou. Basta descartar o preview.
- **Depois do passo 11:** o `github.io` continua no ar (o repositório segue público e o
  workflow segue ativo), então voltar é apontar os aparelhos para o endereço antigo. Como as
  duas origens compartilham o Supabase, não há dado a reconciliar.
- **Na Vercel (Instant Rollback):** reaponta os domínios de produção para um deploy anterior,
  **sem refazer o build**. Condições confirmadas na documentação:
  - _Quais deploys:_ só os que já foram associados a um domínio de produção. Deploys que nunca
    receberam um domínio de produção (a maioria dos previews) não são elegíveis.
  - _Depende do plano:_ no **Hobby** só é possível voltar ao deploy imediatamente anterior; no
    **Pro** e no Enterprise, a qualquer deploy elegível. Quem pode executar também depende das
    permissões na conta e no projeto.
  - _Variáveis de ambiente:_ não são refeitas nem alteradas. O deploy restaurado mantém o build
    antigo e, com ele, os valores `VITE_*` já embutidos; mudanças feitas depois nas variáveis do
    projeto não se aplicam a ele.
  - _Atribuição automática:_ depois de um rollback a Vercel **desliga a atribuição automática**
    de domínios de produção, então novos pushes na branch de produção **não vão ao ar sozinhos**.
  - _Retomar o fluxo normal:_ "Undo Rollback" no painel, que promove outro deploy, ou
    `vercel promote <deploy>` na CLI.
  - _Outros detalhes:_ só um rollback por vez por projeto; aliases personalizados só voltam se já
    estavam no deploy de produção anterior, então confira os domínios listados na tela de
    confirmação.
- **Pelo Git:** por padrão, commit ou merge na branch de produção é promovido automaticamente
  (confirmado). Reverter o commit e enviar deve gerar um build novo, com as variáveis atuais do
  projeto; isso é o comportamento esperado do fluxo padrão e **não consta literalmente** nas
  páginas consultadas. E só vai ao ar sozinho se a atribuição automática estiver ligada, o que
  não ocorre depois de um rollback (ver acima).
- **Não verificado:** o comportamento na conta real do proprietário (plano, permissões e
  configuração de domínios), pois nenhum rollback foi executado.
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
- **No servidor:** os limites das Vercel Functions, listados abaixo, condicionam o desenho.
  Ver "Consequência para o processamento de áudio".
- Processar o áudio de vídeos do YouTube tem implicações de direitos autorais e de termos de
  uso que devem ser analisadas antes de qualquer implementação.

### Limites das Vercel Functions

Verificados em 2026-10-28 em [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
(página atualizada em 2026-08-24). Os valores de duração valem com Fluid compute.

| Limite                       | Hobby                   | Pro                       | Condições                                                                            |
| ---------------------------- | ----------------------- | ------------------------- | ------------------------------------------------------------------------------------ |
| Corpo de requisição/resposta | 4,5 MB                  | 4,5 MB                    | Acima disso a Function devolve o erro 413. A página não diferencia por plano         |
| Duração máxima               | 300 s (padrão e máximo) | 800 s; até 1800 s em beta | Padrão de 300 s. Acima de 800 s exige configuração por função e runtimes específicos |
| Pacote (não comprimido)      | 250 MB (Python: 500 MB) | 250 MB (Python: 500 MB)   | "Large functions" aceitam até 5 GB (beta, exige Fluid compute com Active CPU)        |
| Memória                      | 2 GB / 1 vCPU           | até 4 GB / 2 vCPU         | Padrão de 2 GB / 1 vCPU nos dois planos                                              |

O plano Enterprise tem os mesmos limites de duração do Pro. A página consultada não menciona
GPU.

### Consequência para o processamento de áudio

Quatro caminhos distintos. Esta etapa não implementa nenhum deles.

1. **Upload direto para armazenamento.** O navegador envia o arquivo direto ao armazenamento e o
   servidor só emite o token ou a URL assinada. É o caminho que a Vercel recomenda para
   arquivos acima do limite de corpo (fonte:
   [guia da Vercel sobre o limite de 4,5 MB](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions),
   que cita o Vercel Blob). O projeto já usa o Supabase, cujo Storage é uma alternativa a
   avaliar; seus limites e custos **não foram verificados**.
2. **Transferência de arquivos por uma Function.** Limitada a 4,5 MB por requisição ou
   resposta. O áudio de uma música pode exceder isso, conforme formato, duração e taxa de bits,
   então este não é um caminho confiável para áudio.
3. **Processamento pesado dentro de uma Function.** Sujeito aos limites de duração, memória e
   pacote da tabela. Pode caber em tarefas curtas e leves. A adequação para separação de voz ou
   transcodificação longa **não foi confirmada**, e a documentação consultada não cita GPU.
4. **Processamento em worker externo**, por exemplo FastAPI no Google Cloud. Indicado quando o
   trabalho excede os limites acima ou exige binários e modelos grandes. A Vercel ficaria só com o frontend; o app enfileiraria o trabalho
   e acompanharia o estado (por exemplo pelo Supabase). A página de limites também cita o Vercel
   Workflows para execuções sem limite de duração, opção **não avaliada** aqui.

A escolha envolve custo, segurança (quem pode enviar e baixar arquivos) e a análise de direitos
autorais acima. É uma decisão de arquitetura pendente.

## Divergências preexistentes (não alteradas)

- `ci.yml` passa `VITE_DEFAULT_VENUE_SLUG`, mas o código lê `VITE_KARAOKE_ROOM_SLUG`. Hoje não
  causa dano porque o padrão do código é `just-go`. Detalhes em
  [`DEPLOYMENT.md`](./DEPLOYMENT.md#variáveis-necessárias).
- O teste E2E "host alcança a fila e vê o estado vazio" falha em modo demo, porque o estado
  demo já vem com fila. Ele pressupõe uma sala real e vazia.
- O manifest sai com `lang: "en"`, apesar de o app ser `pt-BR`.

## Fontes oficiais consultadas

Todas verificadas em 2026-10-28. Para as páginas da Vercel, entre parênteses a data de
atualização informada pela própria página; as do GitHub não informam data.

### Vercel

- [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) (2026-09-14): uso
  comercial e planos.
- [Instant Rollback](https://vercel.com/docs/instant-rollback) (2026-07-07): elegibilidade,
  planos, variáveis e atribuição automática.
- [Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment)
  (2026-06-26): promoção de preview e de build em staging.
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) (2026-08-24):
  corpo, duração, pacote e memória.
- [Limite de 4,5 MB do corpo](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions):
  upload direto para armazenamento.

### GitHub

- [Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site):
  exigência de repositório público em contas Free.
- [Changing the visibility of your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site):
  acesso restrito ao site exige Enterprise Cloud.
- [Setting repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility):
  despublicação do Pages ao tornar o repositório privado.
