# COMANDAS — desenho técnico

> **Estado:** proposta para revisão. **Nada foi implementado nem aplicado ao banco.** Este
> documento descreve a Fase 0 (acesso por perfil) e o MVP das comandas. As decisões do
> proprietário estão na seção 1; o que ainda não foi verificado está na seção 12.
>
> **Revisão de 2026-10-28:** o código de verificação por WhatsApp foi **descartado**. O cliente
> informa nome e celular e o **garçom confirma na mesa**. Isso elimina o custo por mensagem e a
> dependência da Meta e da Twilio. Ver seção 3.

## 1. Escopo e decisões

| Tema              | Decisão                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| O que é a comanda | **Só anotação** de itens consumidos. Sem preço, sem fechamento, sem pagamento    |
| Quem usa          | Cliente (abre), garçom (lança e confirma), gerente (relatório e catálogo)        |
| Quando abre       | **Mesmo fora do dia de karaokê.** Fluxo próprio, independente da sala do karaokê |
| Identificação     | Cliente informa **nome e celular**; **o garçom confirma** na mesa. Sem código    |
| Busca do garçom   | Código da comanda, 4 últimos dígitos do celular ou nome                          |
| Validade          | **A comanda só vale no dia** (dia de serviço); nada atravessa dias               |
| Dados do cliente  | **Nome e telefone são guardados para sempre**                                    |
| Catálogo de itens | **O gerente cura.** O garçom pode sugerir itens novos                            |
| Dispositivos      | Garçom e gerente usam o **próprio celular ou o computador**                      |
| Ambiente          | **Sem Docker.** A homologação é um projeto Supabase remoto, separado da produção |
| Piloto            | Armazém Anita                                                                    |

**Fora do escopo agora:** preço, total em dinheiro, fechamento, exportação para o caixa,
pagamento e nota fiscal. O desenho não os impede: o preço entra depois como coluna nova.

## 2. Papéis e acesso

| Papel       | Como entra                                                                                          | Pode                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Cliente** | **Sem login.** Informa nome e celular; a comanda fica protegida por um segredo guardado no aparelho | Abrir a própria comanda do dia e ver o próprio consumo                              |
| **Garçom**  | **E-mail e senha** (Supabase Auth), aprovado pelo gerente                                           | Buscar comandas de hoje, confirmar o celular, lançar e estornar itens, sugerir item |
| **Gerente** | E-mail e senha, aprovado por quem administra o banco (o primeiro) ou pelo gerente                   | Ver todas as comandas e clientes, curar o catálogo, aprovar equipe                  |
| **Host**    | Continua como hoje (karaokê). Fora do escopo das comandas                                           | Sem acesso às comandas                                                              |

**Como a equipe é aprovada.** O garçom cria a própria conta (e-mail e senha) e fica **pendente**.
O gerente vê a lista de pendentes e ativa. Quem não está ativo em `staff_members` não vê nada,
mesmo tendo conta. O **primeiro gerente** é ativado por quem administra o banco, uma única vez,
com autorização. A confirmação por e-mail fica desligada: o acesso quem concede é o gerente.

**Por que o cliente não tem login.** O login anônimo do Supabase tem limite padrão de **30 por hora
por IP**, e o wifi de um bar sai por **um IP só**: numa noite cheia, o limite travaria a abertura de
comandas. Em vez disso, o cliente recebe um **segredo da comanda** (aleatório, de 128 bits) que o
app guarda no aparelho. O banco guarda só o hash dele.

## 3. Identificação do cliente e confirmação pelo garçom

1. O cliente informa **nome**, **celular** e, se quiser, a **mesa**. A comanda abre com
   `phone_status = 'informado'` e recebe o número curto ("Comanda 27").
2. O garçom, na mesa, vê **nome + 4 últimos dígitos** do que o cliente digitou, pergunta os 4
   últimos dígitos do celular e toca em **Confirmar**. O status vira `confirmado`.
3. **Recuperar o acesso** (trocou de aparelho, limpou o navegador): se o celular já tem comanda hoje,
   o app **não devolve** a comanda a quem apenas digitou o número. Pede que chame o garçom, que gera
   um **código de uso único** (6 dígitos, 10 minutos) na tela dele; o cliente o digita e recebe um
   segredo novo.

**O que esse método garante e o que não garante.** Ele pega erro de digitação e comanda duplicada.
**Não prova que o número é do cliente.** Por isso o status aparece ao gerente (`informado` ou
`confirmado`). Se um dia for preciso provar a posse, o código por SMS ou WhatsApp pode ser
acrescentado sem refazer o modelo: basta um terceiro status, `verificado`.

## 4. Modelo de dados

Todas as tabelas têm RLS ligado desde a criação e **nenhuma política para o papel `anon`**. O
cliente fala com o banco só por duas funções (seção 5). Há um `bar_id` em tudo, para o produto
servir mais de um estabelecimento sem refazer o modelo.

| Tabela           | Colunas principais                                                                                                                             | Observação                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `bars`           | `id`, `name`, `timezone`, `day_cutoff_hour` (padrão 6)                                                                                         | Um registro no piloto                                        |
| `staff_members`  | `user_id` (= `auth.uid()`), `bar_id`, `name`, `role` (`garcom`/`gerente`), `active`                                                            | Pendente até o gerente ativar                                |
| `customers`      | `id`, `bar_id`, `name`, `phone_e164`, `phone_last4` (gerada), `phone_status`, `created_at`                                                     | **Guardado para sempre.** Único por `(bar_id, phone_e164)`   |
| `tabs`           | `id`, `bar_id`, `customer_id`, `service_day`, `tab_code`, `table_label`, `secret_hash`, `opened_at`, `voided_at`                               | Única por `(bar_id, customer_id, service_day)`               |
| `tab_items`      | `id`, `tab_id`, `catalog_item_id`, `name_snapshot`, `qty`, `reverses_item_id`, `added_by`, `created_at`                                        | **Só se acrescenta.** Sem `update` nem `delete` para ninguém |
| `catalog_items`  | `id`, `bar_id`, `name`, `name_normalized`, `category`, `status` (`approved`/`suggested`/`archived`), `use_count`, `last_used_at`, `created_by` | Curado pelo gerente                                          |
| `recovery_codes` | `tab_id`, `code_hash`, `expires_at`, `used_at`                                                                                                 | Código de uso único gerado pelo garçom                       |

Decisões que valem explicar:

- **`tab_items` é um livro-razão.** Estorno é uma nova linha com `qty` negativa apontando para a
  original. O total por item é a soma. Isso resolve garçons simultâneos sem conflito, deixa o
  histórico auditável e **evita eventos de DELETE**, que o Realtime não filtra por RLS (seção 12).
- **`name_snapshot`** guarda o nome do item no momento do lançamento. Renomear ou arquivar um item
  no catálogo não altera comandas antigas.
- **`tab_code`** é a numeração curta da noite, sequencial por `(bar_id, service_day)`. Elimina a
  ambiguidade dos 4 últimos dígitos: com 100 clientes numa noite, a chance de duas pessoas
  terminarem com o mesmo final é de cerca de 39%.
- **`voided_at`** permite ao gerente anular uma comanda lixo (testes, duplicada) sem apagá-la.
- **Dia de serviço:** `service_day = ((now() no fuso do bar) − day_cutoff_hour horas)::date`. Com
  corte às 6h, uma comanda aberta às 01h de sábado pertence ao dia de sexta.

## 5. Regras de acesso

**Cliente (sem login) → só por duas funções**, que o banco executa com permissão própria
(`security definer`) e que validam o segredo:

| Função                          | Faz                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `open_tab(nome, celular, mesa)` | Cria o cliente e a comanda de hoje; devolve `tab_code` e o **segredo** (uma única vez). Recusa se o celular já tem comanda hoje |
| `get_my_tab(tab_id, segredo)`   | Devolve a comanda e os itens, **só se o segredo confere**                                                                       |

**Equipe (com login) → RLS por papel:**

| Tabela          | Garçom                                                            | Gerente                                    |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| `customers`     | **Nada direto**: usa `find_tabs`, que não devolve telefone        | Lê tudo, inclusive o telefone              |
| `tabs`          | Lê as de **hoje**; confirma o celular; gera código de recuperação | Lê todas, de qualquer dia; anula           |
| `tab_items`     | **Só insere**, em comanda de hoje, como ele mesmo                 | Lê tudo; insere estorno                    |
| `catalog_items` | Lê aprovados e sugeridos; insere sugestão                         | Tudo (aprovar, renomear, juntar, arquivar) |
| `staff_members` | Cria o próprio pedido de acesso (pendente)                        | Ativa, desativa e lista a equipe           |

Em cada linha, a regra de "hoje" compara `tabs.service_day` com o dia de serviço atual: **depois do
corte, a comanda deixa de aceitar itens**, mas continua visível para o gerente.

O garçom nunca vê o telefone inteiro. `find_tabs` devolve só `(tab_id, tab_code, nome, 4 últimos
dígitos, status, mesa)`, limitado às comandas de hoje e a 10 linhas.

## 6. Fluxos

**Cliente**

1. Lê o QR (por mesa ou na entrada) e cai em `#/comanda`. A rota não mostra a barra do operador.
2. Informa nome e celular e aceita o aviso de privacidade.
3. Vê "Comanda 27" em destaque e a lista de itens, que o app **relê a cada ~15 s enquanto a tela
   está visível** (sem login, o cliente não assina o Realtime).
4. Chama o garçom para confirmar o celular.

**Garçom**

1. Cria a conta (e-mail e senha) na primeira vez e aguarda a ativação pelo gerente.
2. Busca por número da comanda, final do telefone ou nome; **confirma o celular**.
3. Lança itens pelo campo de digitação com autocomplete (seção 7), com quantidade e estorno.
4. Se o cliente não tem celular ou não quer informar, **abre a comanda com nome e mesa**
   (`phone_status = 'sem_celular'`). O bar não para.

**Gerente**

1. Entra do mesmo jeito, no celular ou no computador.
2. **Relatório de consumo:** comandas de hoje por padrão, com busca, itens agrupados e quantidades
   ("3× chopp") e o status do celular. Como não há preço, ele precifica no caixa físico.
3. Cura o catálogo: aprova sugestões, renomeia, **junta duplicatas** e arquiva.
4. Ativa e desativa a equipe; anula comandas lixo.

## 7. Digitação rápida do garçom

- **Busca tolerante** a acento e a abreviação ("chop" acha "Chopp"), sobre `name_normalized`. O
  projeto já tem a normalização de acentos (`semAcento` em `youtubeSearch.ts`), a reutilizar.
- **Ranking** por uso recente e frequência (`use_count`, `last_used_at`). Os 8 itens mais usados de
  cada categoria aparecem como botões grandes.
- **Atalho de quantidade:** digitar `3 chopp` lança 3 de uma vez; tocar de novo no mesmo item soma 1.
- **Item novo digitado** vira uma linha de `catalog_items` com `status = 'suggested'`: já aparece
  para todos os garçons como opção clicável, e o gerente decide depois se aprova, renomeia ou junta
  com outro. Sem essa curadoria, "Cerveja", "cerveja" e "cervja" poluem o catálogo em uma semana.
- **Estorno em um toque**, que acrescenta a linha negativa.
- **Wifi ruim:** reaproveitar a fila de envio que o app já tem (`outbox`), para o lançamento não
  se perder.

## 8. Abuso e custo

Sem código por mensagem, **não há custo por abertura de comanda**. O risco passa a ser **lixo no
banco**: alguém que chame `open_tab` em repetição ou digite números alheios.

| Controle                           | Como                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Uma comanda por celular por dia    | Restrição única `(bar_id, customer_id, service_day)`                                     |
| Teto de comandas abertas por noite | A função recusa acima de um limite do bar (por exemplo, 500)                             |
| Nada de dado alheio vazando        | `open_tab` **nunca devolve** comanda existente; só o garçom gera o código de recuperação |
| QR por mesa                        | Quem não está no bar tem menos motivo e a mesa ajuda o garçom a achar o cliente          |
| Limpeza                            | O gerente anula comandas lixo (`voided_at`); o garçom só vê as de hoje                   |

O CAPTCHA do Supabase cobre o login, não funções próprias; um desafio nas funções exigiria uma
função de borda e fica **fora do piloto**. O teto diário e a restrição única bastam para o tamanho
do Armazém Anita.

## 9. Integração com o app atual

- Novas rotas: `#/comanda`, `#/garcom`, `#/gerente`, sem a barra do operador.
- O provedor do karaokê (`KaraokeProvider`) hoje envolve o app inteiro e abre a conexão da sala em
  qualquer rota. As rotas de comanda não devem abri-la: o provedor passa a ser montado só nas
  rotas do karaokê.
- O cliente do Supabase já existe e **não usa Auth hoje**. Passa a usar para a equipe.
- A tabela do karaokê (`karaoke_queue_entries`) continua com telefone legível por qualquer pessoa.
  Isso é um risco **separado** (ver `SECURITY.md`) e deve ser tratado também, mas não faz parte
  das tabelas novas, que já nascem restritas.

## 10. Dados pessoais (LGPD)

O proprietário decidiu **guardar nome e telefone para sempre**. Isso é possível, desde que:

- o **aviso de privacidade** apareça antes do cadastro, dizendo a finalidade (comanda e contato
  operacional) e que os dados ficam guardados;
- o uso para **divulgação** tenha um consentimento **separado e opcional**, não embutido no cadastro;
- exista **exclusão a pedido**: uma função que remove nome e telefone e **mantém o consumo anônimo**;
- o acesso do gerente ao telefone completo seja registrado.

**Atenção a um risco novo.** Sem verificação por código, um número informado pode **não ser do
cliente** (erro ou má-fé). Guardá-lo para sempre significa guardar dado de um terceiro que nunca
foi consultado. Por isso: o status `informado`/`confirmado` fica visível; o aviso diz que o
cliente declara ser o titular; e a exclusão a pedido vale também para quem **não** é o cliente.

Quando houver preço e pagamento, os registros financeiros terão prazo de guarda legal próprio, e
convém então separar o consumo (anônimo) dos dados do cliente.

## 11. Ambiente, testes e fases

**Ambiente.** **Sem Docker.** Um **projeto Supabase de homologação, separado da produção**, onde
rodam todas as migrations e os testes. **Nenhum teste de comanda roda contra o banco de
produção.** As chaves da homologação ficam em arquivo ignorado pelo Git, separado do `.env` de
produção. Migrations versionadas em `supabase/migrations/`, **aplicadas só com autorização**. Em
produção, o plano do Supabase precisa **não pausar por inatividade**.

**Testes de acesso por papel** (contra a homologação): visitante anônimo não lê nenhuma tabela;
`get_my_tab` recusa segredo errado; garçom não lê telefone nem comanda de ontem; garçom pendente
não vê nada; gerente lê tudo; `open_tab` recusa o mesmo celular duas vezes no dia.

| Fase | Entrega                                                                                | Aceite                                                            |
| ---- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0    | Login da equipe com aprovação, tabelas restritas, funções do cliente, testes de acesso | Anônimo não lê nada; cada papel vê só o que a seção 5 permite     |
| 1    | Cliente abre a comanda e vê o consumo; recuperação de acesso pelo garçom               | Uma comanda por celular por dia; segredo errado é recusado        |
| 2    | Garçom busca, confirma, lança e estorna com autocomplete                               | Lançar um item leva poucos segundos; funciona com a rede instável |
| 3    | Gerente: relatório de consumo, catálogo, equipe                                        | Acha um cliente e lê o consumo no celular em segundos             |

**Métricas:** percentual de clientes que abrem comanda; percentual de números confirmados pelo
garçom; segundos para o garçom lançar um item; percentual de itens vindos do catálogo (contra texto
livre); taxa de estorno; comandas anuladas; clientes que voltam.

## 12. O que foi e o que não foi verificado

Verificado na documentação oficial do Supabase em 2026-10-28:

- Limite padrão do login anônimo: **30 por hora por IP**.
- O Realtime respeita o RLS, mas **não o aplica a eventos de DELETE**.
- Projetos gratuitos podem ser pausados após 7 dias de pouca atividade.
- O código por e-mail tem limite padrão de 2 por hora, alterável só com servidor de e-mail próprio
  (por isso a equipe entra com senha, não com link por e-mail).
- O código por SMS aceita Twilio, Twilio Verify, MessageBird, Vonage e TextLocal; o WhatsApp só
  como canal da Twilio. **Alternativa futura**, hoje descartada.

**Não verificado (resolver antes de implementar):**

- Como desligar a confirmação por e-mail no cadastro da equipe (esperado: opção do painel de Auth).
- Se `security definer` com validação de segredo é suficiente para o cliente sem login ou se convém
  uma função de borda; e o custo de ler a comanda a cada 15 s com muitos clientes.
- O estado das tabelas antigas (`tenants`, `venues`, etc.) no banco remoto, antes de escolher os
  nomes de `bars` e afins.
- O limite de projetos gratuitos da organização, para criar a homologação.

## 13. Protótipo navegável (modo demonstração)

Existe um **protótipo clicável** das três telas, para ver e validar o fluxo antes da Fase 0. Ele
**não é o sistema**: não há banco, login nem segredo da comanda.

| Rota        | Tela                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| `#/comanda` | Cliente: abre a comanda com nome e celular e acompanha o consumo          |
| `#/garcom`  | Garçom: busca, confirma o celular, lança itens com autocomplete e estorna |
| `#/gerente` | Gerente: consumo por dia, curadoria do catálogo e ativação da equipe      |

**O que o protótipo faz de verdade:** as regras de `src/comandas/rules.ts` (dia de serviço, uma
comanda por celular por dia, livro-razão de itens com estorno, busca por código, final do celular
ou nome, digitação rápida `3 chopp`, itens novos viram sugestão, junção de duplicatas). Elas têm
34 testes unitários e um E2E que atravessa os três papéis.

**O que é simulado:**

- Os dados ficam em `localStorage` do navegador, com dados fictícios, e acompanham as outras abas
  **do mesmo navegador** (abra "Cliente" numa aba e "Garçom" noutra). **Não são compartilhados entre
  aparelhos.**
- O "login" da equipe é só escolher o nome. Na versão real, e-mail e senha com aprovação do gerente.
- O segredo da comanda não existe: a comanda do cliente é um ponteiro no aparelho.
- O garçom vê só o final do celular e o gerente vê o número inteiro (isso já segue o desenho).
- O botão "Reiniciar demonstração" restaura os dados fictícios.

**Onde está o código:** `src/comandas/` (carregado sob demanda: quem abre o telão não baixa esse
código). O provedor das comandas é separado do provedor do karaokê, então a sala do karaokê **não
abre conexão** quando só se usa a comanda.
