# COMANDAS — desenho técnico

> **Estado:** proposta para revisão. **Nada foi implementado nem aplicado ao banco.** Este
> documento descreve a Fase 0 (acesso por perfil) e o MVP das comandas. As decisões do
> proprietário estão na seção 1; o que ainda não foi verificado está na seção 12.

## 1. Escopo e decisões

| Tema              | Decisão                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| O que é a comanda | **Só anotação** de itens consumidos. Sem preço, sem fechamento, sem pagamento    |
| Quem usa          | Cliente (abre), garçom (lança itens), gerente (relatório de consumo e catálogo)  |
| Quando abre       | **Mesmo fora do dia de karaokê.** Fluxo próprio, independente da sala do karaokê |
| Verificação       | Código enviado por **WhatsApp**; o cliente digita para confirmar o celular       |
| Busca do garçom   | Código da comanda, 4 últimos dígitos do celular ou nome                          |
| Validade          | **A comanda só vale no dia** (dia de serviço); nada atravessa dias               |
| Dados do cliente  | **Nome e telefone são guardados para sempre**                                    |
| Catálogo de itens | **O gerente cura.** O garçom pode sugerir itens novos                            |
| Dispositivos      | Garçom e gerente usam o **próprio celular ou o computador**                      |
| Piloto            | Armazém Anita                                                                    |

**Fora do escopo agora:** preço, total em dinheiro, fechamento, exportação para o caixa,
pagamento e nota fiscal. O desenho não os impede: o preço entra depois como coluna nova.

## 2. Papéis e acesso

Todos entram com o **mesmo mecanismo: celular e código por WhatsApp**. Não há senha.

| Papel       | Como é reconhecido                                                      | Pode                                                                 |
| ----------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Cliente** | Qualquer celular verificado                                             | Abrir a própria comanda do dia e ver o próprio consumo               |
| **Garçom**  | Celular cadastrado pelo gerente em `staff_members` com o papel `garcom` | Buscar comandas de hoje, lançar e estornar itens, sugerir item       |
| **Gerente** | Celular cadastrado em `staff_members` com o papel `gerente`             | Ver todas as comandas e clientes, curar o catálogo, cadastrar equipe |
| **Host**    | Continua como hoje (karaokê). Fora do escopo das comandas               | Sem acesso às comandas                                               |

O **primeiro gerente** é cadastrado por quem administra o banco (um `insert` único, feito com
autorização). Daí em diante, o gerente cadastra o celular de cada garçom: não há convite por
QR, senha nem e-mail. Quem não está na tabela é cliente.

## 3. Modelo de dados

Todas as tabelas novas têm RLS ligado desde a criação e **nenhuma política para o papel
`anon`**. Existe um `bar_id` em tudo, para o produto servir mais de um estabelecimento sem
refazer o modelo.

| Tabela          | Colunas principais                                                                                                                             | Observação                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `bars`          | `id`, `name`, `timezone`, `day_cutoff_hour` (padrão 6)                                                                                         | Um registro no piloto                                        |
| `staff_members` | `bar_id`, `phone_e164`, `name`, `role` (`garcom`/`gerente`), `active`                                                                          | Quem não está aqui é cliente                                 |
| `customers`     | `id` (= `auth.uid()`), `phone_e164` único, `phone_last4` (gerada), `name`, `created_at`                                                        | **Guardado para sempre.** Ver LGPD (seção 9)                 |
| `tabs`          | `id`, `bar_id`, `customer_id` (pode ser nulo), `guest_name`, `service_day`, `tab_code`, `table_label`, `verified`, `opened_at`                 | Única por `(bar_id, customer_id, service_day)`               |
| `tab_items`     | `id`, `tab_id`, `catalog_item_id`, `name_snapshot`, `qty`, `reverses_item_id`, `added_by`, `created_at`                                        | **Só se acrescenta.** Sem `update` nem `delete` para ninguém |
| `catalog_items` | `id`, `bar_id`, `name`, `name_normalized`, `category`, `status` (`approved`/`suggested`/`archived`), `use_count`, `last_used_at`, `created_by` | Curado pelo gerente                                          |

Decisões que valem explicar:

- **`tab_items` é um livro-razão.** Estorno é uma nova linha com `qty` negativa apontando para a
  original (`reverses_item_id`). O total por item é a soma. Isso resolve garçons simultâneos sem
  conflito, deixa o histórico auditável e **evita eventos de DELETE**, que o Realtime não filtra
  por RLS (seção 12).
- **`name_snapshot`** guarda o nome do item no momento do lançamento. Renomear ou arquivar um item
  no catálogo não altera comandas antigas.
- **`tab_code`** é a numeração curta da noite ("Comanda 27"), sequencial por `(bar_id, service_day)`.
  Elimina a ambiguidade dos 4 últimos dígitos: com 100 clientes numa noite, a chance de duas
  pessoas terminarem com o mesmo final é de cerca de 39%.
- **`customer_id` nulo + `guest_name`** é a **contingência**: se o WhatsApp falhar, o garçom abre
  a comanda com nome e mesa, marcada `verified = false`. O bar não para.
- **Dia de serviço:** `service_day = ((now() no fuso do bar) − day_cutoff_hour horas)::date`. Com
  corte às 6h, uma comanda aberta às 01h de sábado pertence ao dia de sexta.

## 4. Regras de acesso (RLS)

| Tabela          | Cliente                       | Garçom                                            | Gerente                            |
| --------------- | ----------------------------- | ------------------------------------------------- | ---------------------------------- |
| `customers`     | Lê e altera só o próprio nome | **Nada direto** (usa `find_tabs`, sem telefone)   | Lê tudo, inclusive o telefone      |
| `tabs`          | Lê só a própria               | Lê as de **hoje**; abre comanda de contingência   | Lê todas, de qualquer dia          |
| `tab_items`     | Lê só os da própria comanda   | **Só insere**, em comanda de hoje, como ele mesmo | Lê tudo; insere estorno            |
| `catalog_items` | Nada                          | Lê aprovados e sugeridos; insere sugestão         | Tudo (aprovar, renomear, arquivar) |
| `staff_members` | Nada                          | Nada                                              | Gerencia                           |

Em cada linha, a regra de "hoje" compara `tabs.service_day` com o dia de serviço atual: **depois do
corte, a comanda deixa de aceitar itens**, mas continua visível para o gerente.

O garçom nunca vê o telefone inteiro. A busca é uma **função** que devolve só
`(tab_id, tab_code, nome, 4 últimos dígitos, mesa)`, limitada às comandas de hoje e a 10 linhas.
Isso reduz o risco de alguém enumerar clientes digitando finais de telefone.

## 5. Fluxos

**Cliente**

1. Lê o QR (por mesa ou na entrada) e cai em `#/comanda`. A rota não mostra a barra do operador.
2. Informa **nome e celular**, aceita o aviso de privacidade e recebe o código por WhatsApp.
3. Digita o código. A função `open_tab()` devolve a comanda de hoje (cria na primeira vez; nas
   leituras seguintes do mesmo dia, devolve a mesma).
4. Vê "Comanda 27" em destaque e a lista de itens, **atualizada ao vivo** quando o garçom lança.

**Garçom**

1. Entra com o próprio celular (código por WhatsApp). A sessão dura o turno.
2. Busca por número da comanda, final do telefone ou nome.
3. Lança itens pelo campo de digitação com autocomplete (seção 6), com quantidade e estorno.

**Gerente**

1. Entra do mesmo jeito, no celular ou no computador.
2. **Relatório de consumo:** comandas de hoje por padrão, com busca, itens agrupados e quantidades
   ("3× chopp"). Como não há preço, ele precifica no caixa físico.
3. Cura o catálogo: aprova sugestões, renomeia, **junta duplicatas** e arquiva.
4. Cadastra e desativa o celular dos garçons.

## 6. Digitação rápida do garçom

- **Busca tolerante** a acento e a abreviação ("chop" acha "Chopp"), sobre `name_normalized`. O
  projeto já tem a normalização de acentos (`semAcento` em `youtubeSearch.ts`), a reutilizar.
- **Ranking** por uso recente e frequência (`use_count`, `last_used_at`). Os 8 itens mais usados de
  cada categoria aparecem como botões grandes.
- **Atalho de quantidade:** digitar `3 chopp` lança 3 de uma vez; tocar de novo no mesmo item soma 1.
- **Item novo digitado** vira uma `catalog_items` com `status = 'suggested'`: já aparece para todos os
  garçons como opção clicável (o que você pediu), e o gerente decide depois se aprova, renomeia ou
  junta com outro. Sem essa curadoria, "Cerveja", "cerveja" e "cervja" poluem o catálogo em uma semana.
- **Estorno em um toque**, que acrescenta a linha negativa.
- **Wifi ruim:** reaproveitar a fila de envio que o app já tem (`outbox`), para o lançamento não
  se perder.

## 7. Verificação do celular e abuso

O endpoint que envia o código é **público e custa dinheiro por mensagem**. Controles previstos:

| Controle                                                  | Situação                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Um código por 60 s por usuário                            | **Padrão do Supabase** (confirmado)                                                                                         |
| Limite de 360 códigos/hora e 360 verificações/hora por IP | **Padrão do Supabase**, ajustável (confirmado)                                                                              |
| CAPTCHA (hCaptcha ou Turnstile)                           | O Supabase o suporta, **mas a documentação não confirma que cobre o código por telefone**. Verificar antes de depender dele |
| Só números brasileiros (`+55`)                            | **A verificar** no Supabase; sem isso, só o cliente valida                                                                  |
| Teto de gasto de mensagens                                | **A verificar** na Twilio (limite e alertas de uso)                                                                         |
| QR por mesa e telefone já verificado reaproveitado        | Reduz novos envios: a segunda leitura no mesmo aparelho não reenvia                                                         |

## 8. Integração com o app atual

- Novas rotas: `#/comanda`, `#/garcom`, `#/gerente`, sem a barra do operador.
- O provedor do karaokê (`KaraokeProvider`) hoje envolve o app inteiro e abre a conexão da sala em
  qualquer rota. As rotas de comanda não devem abri-la: o provedor passa a ser montado só nas
  rotas do karaokê.
- O cliente do Supabase já existe e **não usa Auth hoje**. A sessão é guardada no navegador.
- A tabela do karaokê (`karaoke_queue_entries`) continua com telefone legível por qualquer pessoa.
  Isso é um risco **separado** (ver `SECURITY.md`) e deve ser tratado também, mas não faz parte
  das tabelas novas, que já nascem restritas.

## 9. Dados pessoais (LGPD)

O proprietário decidiu **guardar nome e telefone para sempre**. Isso é possível, desde que:

- o **aviso de privacidade** apareça antes do cadastro, dizendo a finalidade (comanda e contato
  operacional) e que os dados ficam guardados;
- o uso para **divulgação** tenha um consentimento **separado e opcional**, não embutido no cadastro;
- exista **exclusão a pedido**: uma função que remove nome e telefone e **mantém o consumo anônimo**;
- o acesso do gerente ao telefone completo seja registrado.

Quando houver preço e pagamento, os registros financeiros terão prazo de guarda legal próprio, e
convém então separar o consumo (anônimo) dos dados do cliente.

## 10. Ambiente e testes

- **Um projeto Supabase de homologação, separado da produção.** Os testes de acesso e do fluxo do
  WhatsApp rodam lá, com números de teste. **Nenhum teste de comanda roda contra o banco de produção.**
- Testes de RLS por papel: visitante anônimo não lê nada; cliente lê só o seu; garçom não lê
  telefone nem comanda de ontem; gerente lê tudo.
- Migrations versionadas em `supabase/migrations/`, **aplicadas só com autorização** e depois da
  revisão.
- O Supabase em produção precisa de um plano que **não pause por inatividade** (projetos gratuitos
  podem ser pausados após 7 dias de pouca atividade).

## 11. Fases e critérios de aceite

| Fase | Entrega                                                                     | Aceite                                                            |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0    | Autenticação por celular, `staff_members`, tabelas restritas, testes de RLS | Anônimo não lê nada; cada papel vê só o que a seção 4 permite     |
| 1    | Cliente abre a comanda, verifica o celular e vê o consumo ao vivo           | Uma comanda por cliente por dia; reabrir devolve a mesma          |
| 2    | Garçom busca, lança e estorna com autocomplete                              | Lançar um item leva poucos segundos; funciona com a rede instável |
| 3    | Gerente: relatório de consumo, catálogo, equipe                             | Acha um cliente e lê o consumo no celular em segundos             |

**Métricas:** percentual de clientes que abrem comanda; taxa e tempo de verificação; **custo por
cliente verificado**; segundos para o garçom lançar um item; percentual de itens vindos do catálogo
(contra texto livre); taxa de estorno; clientes que voltam. **Critério de parada:** se o custo por
verificação ou o abandono forem altos, o piloto cai para identificação leve (nome e mesa, sem código).

## 12. O que foi e o que não foi verificado

Verificado na documentação oficial do Supabase em 2026-10-28:

- O código por telefone aceita Twilio, Twilio Verify, MessageBird, Vonage e TextLocal
  (comunidade). **WhatsApp só como canal do Twilio ou Twilio Verify.**
- Limites padrão de autenticação: um código por 60 s, 360 códigos e 360 verificações por hora.
- O Realtime respeita o RLS, mas **não o aplica a eventos de DELETE**.
- Projetos gratuitos podem ser pausados após 7 dias de pouca atividade.

**Não verificado (resolver antes de implementar):**

- Se o CAPTCHA do Supabase protege o código por telefone.
- Como restringir o envio a `+55` e como limitar o gasto (Supabase e Twilio).
- A **taxa da Twilio** por cima da Meta, e o processo de **verificação do negócio e aprovação do
  modelo de mensagem** do WhatsApp. É o item de **maior prazo**: convém começar cedo.
- A tarifa vigente da Meta para autenticação no Brasil: a página consultada só traz uma nota de
  rodapé (cerca de 0,68 centavos de dólar por mensagem, sem confirmar a moeda nem a categoria).
- Se o claim `phone` vem no `auth.jwt()`, para o reconhecimento da equipe por celular.
- O estado das tabelas antigas (`tenants`, `venues`, etc.) no banco remoto, antes de escolher os
  nomes de `bars` e afins.
