# TESTING — Karaokê Just Go

## Ferramentas

- **Vitest** — testes unitários das regras de negócio (jsdom).
- **Playwright** — E2E das três experiências, em Chromium e perfil mobile.
- **ESLint + TypeScript** — barreira estática, roda antes dos testes no CI.

## Comandos

```bash
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint .
npm run test        # vitest run
npm run test:watch  # vitest em modo watch
npm run test:e2e    # playwright test (builda e sobe o preview sozinho)
```

## O que é testado, e por quê

### Unitário — `tests/unit/`

O alvo é [`src/store/reducer.ts`](../src/store/reducer.ts), a função pura onde vivem todas as
regras de negócio. Testar o reducer cobre a lógica do produto sem montar componente nem mockar
rede, então os testes são rápidos e não quebram quando a interface muda de cor.

| Arquivo               | Cobre                                                            |
| --------------------- | ---------------------------------------------------------------- |
| `queue-rules.test.ts` | Aprovação, recusa, ordem da fila, apresentação única, histórico  |
| `telao-rules.test.ts` | Publicação, contagem regressiva, retorno automático, publicidade |

Casos que existem porque quebraram de verdade:

- **"ignora movimentos fora dos limites da fila"** nasceu de um bug real: os identificadores
  locais usavam `Date.now()` e colidiam quando duas entradas eram criadas no mesmo
  milissegundo, fazendo as ações atingirem a entrada errada.
- **"conta o tempo restante a partir do relógio"** protege a convergência do telão entre
  dispositivos. Se alguém trocar por um decremento simples, o teste cai.
- **"recusa 13 dígitos com DDI de outro país"** evita o pior caso da chamada por WhatsApp:
  abrir conversa com alguém que não é o participante.
- **"todas as músicas da demonstração existem no catálogo"** acusa quando uma regeração
  derruba uma música, antes de a demonstração cair no fallback na frente de uma turma.

### E2E — `tests/e2e/smoke.spec.ts`

Roda contra o **build de produção** servido no base path do GitHub Pages, não no dev server.
É o que mais se aproxima do que o bar vai abrir.

| Teste                          | Verifica                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| Participante envia solicitação | Busca, seleção, modal de nome e tela de aguardando aprovação |
| Modo palco abre pela rota      | `#/telao` carrega direto, sem passar pela home               |
| Host entra sem senha           | `#/host`, nome do Host e acesso ao controle do telão         |

## Atenção ao rodar o E2E localmente

Se o `.env` tiver as variáveis do Supabase, o build embute essas credenciais e **os testes
escrevem no banco real**. O teste do participante cria uma solicitação pendente de verdade.

Para rodar isolado, use um `.env` sem as variáveis do Supabase — o app cai em modo demo e nada
sai da aba. Se rodar contra o banco, limpe depois:

```sql
delete from public.karaoke_queue_entries where participant = 'Teste E2E';
```

## Verificação de sincronia entre dispositivos

Os testes do Playwright abrem uma tela por vez. A promessa central do produto — o que acontece
num aparelho aparecer nos outros — só dá para verificar com os três abertos ao mesmo tempo.

```bash
npm run build && npm run preview     # num terminal
node scripts/verifica-sincronia.mjs  # noutro
```

O script abre participante, Host e telão em paralelo e confere doze pontos: a solicitação
chegando ao Host, o botão de WhatsApp montando o link com DDI, a marcação de "já chamado", o
preview do Host batendo com a TV, o CTA aparecendo nos dois, e o telão em modo QR sem texto
sobrando.

Exige Supabase configurado. Em modo demo cada aba tem o seu próprio estado, então o resultado
não significaria nada. **Escreve na sala real** — o script avisa ao final como limpar.

Vale rodar antes de um evento, junto com o checklist de [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## O que ainda não é testado

- A camada `services/karaokeRepository.ts` não tem teste próprio. A tradução domínio ⇄ Postgres
  é exercitada pelo E2E e pelo script de sincronia quando o Supabase está configurado.
- Se os vídeos do catálogo continuam no ar. Exigiria rede e deixaria a suíte instável — a
  verificação está no gerador (`node scripts/gen-karaoke-catalog.mjs --dry`).
- O envio da mensagem no WhatsApp em si, que depende do aplicativo e do clique do Host.
- Acessibilidade e contraste do modo palco.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda lint, testes unitários e build
em todo push e PR para `main`. O E2E **não** roda no CI hoje, justamente para não escrever no
banco de produção durante o pipeline. Rode localmente antes de mudanças grandes na interface.
