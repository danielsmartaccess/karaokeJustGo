# SECURITY — Karaokê Just Go

## Postura atual, em uma frase

Este MVP opera **sem autenticação**, por decisão de produto, e o banco aceita leitura e
escrita anônimas nas tabelas `karaoke_*`. Isso é aceitável enquanto a operação é de um bar só,
com link não divulgado, e deixa de ser no momento em que o produto atender mais de um
estabelecimento.

## A decisão do Host sem senha

O Host conduz a noite. Ele precisa assumir o painel em segundos, às vezes num aparelho
emprestado, no meio de um salão barulhento. Uma tela de login com senha, recuperação e
sessão expirada atrapalha exatamente no momento em que o sistema mais precisa sair da frente.

Então `#/host` pede só o nome, guarda em `localStorage` e entra. O nome é identificação
operacional — quem está conduzindo —, não credencial.

**O que isso significa na prática:** qualquer pessoa que descubra a URL pode abrir o painel do
Host, aprovar ou cancelar solicitações e publicar conteúdo no telão.

**Por que é tolerável hoje:** o público-alvo é um bar; o link do Host não é divulgado; o telão
fica à vista de todos, então um uso indevido é percebido na hora; e o dano máximo é uma noite
bagunçada, não vazamento de dado sensível ou prejuízo financeiro.

**Quando deixa de ser:** múltiplos estabelecimentos, cobrança por uso, ou qualquer dado que
não possa ser visto pelo salão inteiro.

## Consequência no banco

Como participante e Host chegam pela mesma role `anon`, as políticas RLS são permissivas:

```sql
create policy karaoke_queue_entries_anon_all
  on public.karaoke_queue_entries
  for all to anon, authenticated
  using (true) with check (true);
```

O mesmo vale para `karaoke_rooms`, `karaoke_screen_contents` e `karaoke_advertisements`.

Isso está escrito na migration
[`20260918120000_karaoke_rooms.sql`](../supabase/migrations/20260918120000_karaoke_rooms.sql)
com o aviso correspondente, para que ninguém leia como descuido.

## O que continua protegido

- **Chave publicável apenas.** O frontend usa `VITE_SUPABASE_ANON_KEY`. A `service_role`
  nunca aparece no cliente, no repositório ou nas variáveis do build.
- **`.env` fora do versionamento.** Apenas `.env.example` é commitado.
- **RLS habilitado em todas as tabelas.** Permissivo hoje, mas o mecanismo está ligado —
  restringir é mudar políticas, não reescrever o acesso.
- **Regras críticas no banco.** "Apenas uma apresentação em execução" é um índice único
  parcial, não um `if` no cliente.
- **Validação de tamanho.** `participant` tem `check` de 1 a 60 caracteres; `duration_seconds`
  é limitado a 3600.
- **Segredos do deploy em GitHub Secrets.** Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Riscos aceitos, explicitamente

| Risco                                            | Impacto | Mitigação atual                              |
| ------------------------------------------------ | ------- | -------------------------------------------- |
| Acesso não autorizado ao painel do Host          | Médio   | URL não divulgada; telão à vista             |
| Escrita anônima na fila (spam de solicitações)   | Baixo   | Toda entrada passa pela aprovação do Host    |
| Publicidade com URL de imagem arbitrária         | Médio   | Só o Host publica; preview antes de ir ao ar |
| Telefone do participante legível por qualquer um | Médio   | Campo opcional; ainda não é usado            |

O terceiro item merece atenção: o telão renderiza qualquer URL de imagem que o Host colar. Não
há validação de domínio nem de conteúdo. O preview antes de publicar é a defesa, e ela depende
de quem opera.

## Caminho para produção multi-bar

1. Ativar Supabase Auth. Login do Host por e-mail com link mágico ou OTP por telefone.
2. Criar `karaoke_hosts` ligando `auth.uid()` à sala.
3. Restringir a escrita: participante só pode inserir com `status = 'pending'` na sala dele;
   aprovar, reordenar, iniciar, cancelar e publicar no telão passam a exigir Host autenticado.
4. Manter a leitura pública — o telão precisa funcionar sem login.
5. Validar `image_url` contra uma lista de domínios permitidos ou subir a imagem para o
   Supabase Storage em vez de aceitar URL externa.
6. Tratar o telefone como dado pessoal sob a LGPD: consentimento explícito, finalidade
   declarada e prazo de retenção.

## LGPD

Dados pessoais coletados hoje: **nome ou apelido** (obrigatório) e **telefone WhatsApp**
(opcional). Não há e-mail, documento nem dado de pagamento.

O telefone é coletado para avisar o participante que a vez dele chegou, mas essa funcionalidade
ainda não existe. Enquanto não existir, o campo coleta um dado pessoal sem uso — vale remover
o campo ou implementar a notificação antes da próxima operação real.

## Reportar um problema

Abra uma issue privada no repositório ou fale direto com a Just Go Smart Access. Não publique
detalhes de vulnerabilidade em issue pública.
