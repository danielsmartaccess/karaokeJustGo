# TESTING — Just Go Karaoke

## Ferramentas

- **Vitest** — testes unitários (domínio) e de componente (jsdom + Testing Library).
- **Playwright** — E2E (Chromium + perfil mobile).

## Comandos

```bash
npm run test        # unit (Vitest, uma passada)
npm run test:watch  # unit em watch
npm run test:e2e    # E2E (Playwright) — builda e serve o preview automaticamente
```

## Cobertura atual (FASE 1) — 25 testes

- **Máquina de estados da apresentação** — fluxo feliz, transições inválidas, cancelamento,
  estados terminais.
- **Regras de votação** — elegibilidade (auto-voto, ausente, duplicado, janela 60s, limites),
  validação de notas, cálculo de resultado (médias, %, Nota da Plateia).
- **XP** — defaults e tabela configurável.
- **E2E smoke** — home do participante carrega e navega.

## Alvos por fatia (seção 43)

**Unitários:** cálculo de notas · elegibilidade · janela de votação · XP · fama · badges ·
ranking · Performance da Noite · transições de estado.

**Integração:** criação de sessão · entrada · fila · apresentação · votação · resultado ·
pontuação.

**E2E (fluxos críticos):**

1. QR → cadastro → sessão
2. busca → música → fila
3. HOST → chamada → apresentação
4. apresentação → votação 60s → resultado
5. resultado → XP → ranking
6. votar duas vezes (bloqueado)
7. votar na própria apresentação (bloqueado)
8. votar após 60s (bloqueado)
9. participante tentando acessar HOST (bloqueado)

## Regra

Nunca afirmar que algo foi testado sem executar `npm run lint && npm run test && npm run build`
(e `npm run test:e2e` quando aplicável).
