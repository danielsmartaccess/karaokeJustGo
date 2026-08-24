# DEPLOYMENT — Just Go Karaoke

## Frontend → GitHub Pages (via GitHub Actions)

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em push/PR para
`main`:

1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `npm run build` (com secrets do Supabase)
5. `cp dist/index.html dist/404.html` (SPA fallback)
6. Deploy no GitHub Pages (apenas em `main`)

O deploy **não ocorre** se lint, testes ou build falharem.

### Configuração única no repositório

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions**, adicionar:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Base path e SPA

- `vite.config.ts` define `base: '/karaokeJustGo/'` (precisa bater com o nome do repositório).
- Deep-links (ex.: `/karaokeJustGo/host`) funcionam porque o `404.html` (cópia do `index.html`)
  reinicializa o SPA e o React Router resolve a rota no cliente.
- URL de produção: `https://danielsmartaccess.github.io/karaokeJustGo/`.

## Backend → Supabase

- Schema versionado em `supabase/migrations/` (FASE 2). O banco é reconstruível via migrations.
- Edge Functions em `supabase/functions/` quando necessário.
- Projeto Supabase criado via MCP na FASE 2 (decisão de 2026-08-15).

### Configuração única no projeto Supabase (FASE 3)

1. **Authentication → Sign In / Providers → Anonymous** → habilitar. Necessário para
   `/join` (participante) e `/host` — ambos usam Supabase Anonymous Auth (docs/SECURITY.md).
   Sem isso, essas telas mostram erro `Anonymous sign-ins are disabled`.
2. **Bootstrap do primeiro host:** abra `/host` uma vez autenticado (cria o profile
   anônimo automaticamente), copie o id de perfil mostrado na tela de "sem permissão" e
   insira uma linha em `venue_staff` (`role = 'ADMIN'`) para esse `profile_id` no venue —
   via migration ou MCP. Não existe UI de auto-promoção (por design, é um ato de confiança
   explícito).

## Checklist de release

```bash
npm run lint && npm run test && npm run build
npm run test:e2e   # quando aplicável
```

Depois: `git push origin main` → acompanhar o Actions → validar a URL de produção.
