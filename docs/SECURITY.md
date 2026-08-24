# SECURITY — Just Go Karaoke

## Princípios

- **Nunca confiar apenas no frontend.** Regras sensíveis são validadas no backend (RLS +
  Edge Functions). `if (role === 'ADMIN')` no cliente é UX, não segurança.
- **Somente a `anon` (publishable) key** existe no frontend. A `service_role` key, secrets,
  credenciais e tokens privados **nunca** vão para o cliente nem para o repositório.
- Apenas variáveis com prefixo `VITE_` são expostas ao build.

## Autenticação (FASE 3)

Identidade via **Supabase Anonymous Auth** — sem senha, cadastro é só nome + WhatsApp
(seção 32). Mesmo mecanismo para participante e host: o papel HOST/ADMIN vem de uma linha
em `venue_staff`, não do método de login. Requer "Anonymous Sign-ins" habilitado no projeto
(Authentication → Sign In / Providers → Anonymous) — ver docs/DEPLOYMENT.md.

Consequência aceita nesta fase: uma conta anônima é presa ao navegador/dispositivo (sem
recuperação se limpar dados). Upgrade para credencial permanente (vincular e-mail) fica para
uma fase de polimento, quando fizer sentido para contas de HOST/ADMIN de longa duração.

## Exposição pública de nome (FASE 5)

`profiles` é restrito ao dono (`auth.uid() = id`). Mas a fila precisa mostrar **quem** está
cantando para os outros participantes — puro produto social (docs/PRODUCT.md, "eu faço
parte"). Solução: view `public.public_profiles` (`id`, `display_name`, `avatar_url` — nunca
`whatsapp`) com `security_invoker = false`, que intencionalmente contorna a RLS self-only da
tabela base só para essas 3 colunas não-sensíveis. `get_advisors` marca isso como
`security_definer_view` (ERROR) — **revisado e aceito**: é a forma correta e auditável de
fazer projeção pública parcial no Postgres; a alternativa (grants por coluna) é mais difícil
de auditar, não mais segura. `whatsapp` nunca é exposto via esta view nem em nenhuma rota.

## Row Level Security

RLS habilitado em todas as tabelas. Políticas coerentes com multi-tenancy: um usuário de um
tenant não acessa dados privados de outro tenant.

## Votação — superfícies de ataque (seções 19, 35)

Validação obrigatória **no backend**:

- ❌ auto-votação (votante = cantor)
- ❌ voto duplicado na mesma apresentação
- ❌ voto fora da janela de 60s
- ❌ voto após o encerramento
- ✅ votante presente/online na sessão
- ✅ payload validado (notas inteiras 1–5)

As mesmas regras existem em `src/domain/voting/rules.ts` para guiar a UI, mas a fonte de
verdade é o servidor.

## Gamificação

XP/fama/badges são atribuídos por lógica de servidor (RPC/trigger/Edge Function), nunca por
gravação direta do cliente — proteção contra manipulação de XP.

## Boas práticas gerais

- Dados pessoais nunca em query string/URL.
- Cadastro mínimo (nome + WhatsApp); sem dados desnecessários.
- Tratamento de erros explícito (loading/sucesso/erro/retry), sem `console.log` como
  tratamento.
- Logs de auditoria (`audit_logs`) para ações sensíveis.

## Segredos e CI

- `.env` no `.gitignore`; `.env.example` documenta as variáveis públicas.
- Secrets do deploy (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) via GitHub Secrets.
