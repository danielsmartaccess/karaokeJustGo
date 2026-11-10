# Comandas: guia para revisar o SQL e autorizar a aplicação

Para o dono, sem precisar saber SQL. **Histórico:** este guia foi escrito antes da aplicação. Em
2026-11-10 as 5 migrations foram aplicadas, uma por vez, com autorização do dono e conferência de
segurança depois de cada uma (o que está descrito abaixo como "plano" foi o que se fez). Elas foram
testadas antes num Postgres local (`npm test`, pasta `tests/db/`, 99 testes).

**Regra de ouro:** eu só aplico uma migration depois de você escrever, no chat, **"aplique a
migration N"**. Uma por vez. Depois de cada uma eu rodo o verificador de segurança do Supabase e te
mostro o resultado antes de seguir.

## 0. Antes de qualquer coisa (3 conferências suas, no painel do Supabase)

| #   | O que conferir                                                                          | Onde                                                 | Por quê                                                 |
| --- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| 1   | A integração **GitHub** do projeto **não** aplica migrations sozinha ao receber commits | Project Settings, Integrations, GitHub (e Branching) | Se aplicar, um push/merge executaria o SQL sem você ver |
| 2   | O projeto está no plano **Pro**                                                         | Billing                                              | Já confirmado: organização "Just Go Karaoke" em Pro     |
| 3   | Você sabe qual e-mail será o **primeiro gerente**                                       | —                                                    | Sem gerente ativo ninguém aprova a equipe (ver seção 4) |

## 1. O que cada migration faz (em português)

Todas são **aditivas**: só criam objetos novos com o prefixo `comanda_`. Nenhuma altera, apaga ou
lê as tabelas do karaokê, nem as antigas.

| #   | Arquivo                                         | Em uma frase                                                                                              | O que olhar                                                                                                                           |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `20261110151326_comandas_core.sql`              | Cria as 5 tabelas, tranca todas (sem acesso direto para ninguém) e protege o livro-razão contra alteração | Procure `enable row level security` e `revoke all` nas 5 tabelas; o bloco `comanda_forbid_change` impede editar ou apagar lançamentos |
| 2   | `20261110152826_comandas_client_functions.sql`  | Três portas para o **cliente sem login**: abrir comanda, ver a própria, pedir a conta                     | O segredo é gerado no banco e só o **hash** fica guardado; segredo errado e comanda inexistente dão a mesma resposta                  |
| 3   | `20261110153012_comandas_staff_functions.sql`   | Portas da **equipe**: cadastro, busca, lançar, estornar, confirmar celular, recuperar acesso              | Toda função chama `comanda_require_role`: sem ser da equipe ativa, devolve `forbidden`. O garçom nunca recebe o telefone inteiro      |
| 4   | `20261110153632_comandas_manager_functions.sql` | Portas do **gerente**: fechar, reabrir, anular, catálogo e preços, equipe, relatório                      | `comanda_close_tab` congela o total e recusa itens sem preço; o gerente não desativa a si mesmo                                       |
| 5   | `20261110155639_comandas_sales_assist.sql`      | "Costuma sair junto" e o botão "−" do cardápio                                                            | Só lê comandas e cria estornos; nada novo em acesso                                                                                   |

**Padrão de segurança que se repete (confira em qualquer função):**

- `security definer` + `set search_path = ''`: a função roda com permissão própria e não aceita
  atalhos de nome (protege contra um ataque conhecido de "sequestro de schema").
- Cada migration termina com `revoke execute ... from public, anon, authenticated` e só depois
  `grant execute` para quem pode. É isso que impede o `anon` (chave pública do app) de chamar o que
  não deve. Os testes reproduzem a armadilha do Supabase (funções novas nascem abertas) e provam que
  esse `revoke` funciona.

## 2. O que NÃO muda

- Telão, Host, fila, publicidade e todas as tabelas `karaoke_*`: **intactos**.
- As tabelas do modelo antigo (`tenants`, `venues`, `profiles`...): **intactas**. A limpeza delas
  fica para depois, por decisão sua.
- O app em produção continua em **modo demonstração** para as comandas até você ligar
  `VITE_COMANDAS_LIVE=true`. Aplicar o SQL sozinho não muda nada para quem usa o karaokê hoje.

## 3. Ordem de aplicação e verificação

Para cada migration N (1 a 5), depois do seu "aplique":

1. Eu aplico só a migration N.
2. Rodo o verificador de segurança (`get_advisors`) e comparo com o estado de hoje (hoje há 2 views
   `security definer` antigas, 1 função antiga executável por anon e a proteção de senha vazada
   desligada). **Nenhum alerta novo pode aparecer** por causa das comandas.
3. Confiro que o telão e a fila continuam respondendo (leitura).
4. Te mostro o resultado e espero o seu "próxima".

## 4. Depois da migration 5: preparar o acesso (também só com a sua ordem)

1. **Ligar a proteção contra senha vazada** no Auth (Authentication, Providers, Email). Hoje está
   desligada.
2. **Criar o primeiro gerente.** Você cria o usuário com e-mail e senha em Authentication, Users.
   Depois roda **uma vez** no SQL Editor (troque o id e o nome):
   `insert into public.comanda_staff (user_id, name, role, active) values ('<id do usuário>', 'Seu nome', 'gerente', true);`
3. Ligar o app: variável `VITE_COMANDAS_LIVE=true` na Vercel (somente Production) e novo deploy.
4. Entrar em `/#/gerente` e fazer o primeiro fechamento de teste.

## 5. Plano de volta

`supabase/scripts/rollback-comandas.sql` desfaz tudo que as 5 migrations criaram e **só isso**.
Está testado (`tests/db/rollback.test.ts`). **É destrutivo**: apaga comandas, itens, catálogo e
equipe das comandas. Só roda com a sua ordem explícita. Depois dele, remover as 5 linhas
`*_comandas_*` de `supabase_migrations.schema_migrations`.

Desligar o modo ao vivo é ainda mais simples e sem perda de dados: tirar `VITE_COMANDAS_LIVE` na
Vercel e fazer novo deploy volta o app para a demonstração.

## 6. Limites conhecidos (para decidir com os olhos abertos)

- **Concorrência real** não foi testada (o Postgres local tem uma conexão só). As funções travam a
  comanda (`for update`) ao lançar, estornar e fechar para evitar corrida; vale observar no piloto.
- **Sem tempo real:** as telas consultam a cada 6 a 15 segundos (o RLS fechado impede o Realtime).
- **Abuso na abertura pública:** há o teto de 500 comandas por dia e a regra de um celular por dia.
  Falta limite por aparelho/IP: é uma das pendências antes de divulgar o QR.
- **Dados pessoais:** nome e telefone ficam guardados (decisão sua). Falta o aviso de privacidade
  definitivo e o processo de exclusão a pedido.
- **Postgres do teste é a versão 18**; o Supabase usa a 17. Não usei nada exclusivo da 18, mas vale
  o verificador após cada migration.
