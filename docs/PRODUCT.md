# PRODUCT — Just Go Karaoke

## Visão

Não é um sistema de fila de karaokê. É uma plataforma de **pertencimento, participação,
reconhecimento e diversão**. O karaokê é o contexto; a experiência social é o produto.

Objetivo emocional: a pessoa entra pensando _"vou cantar uma música"_ e termina a noite
pensando _"eu fiz parte daquela noite"_.

## Três níveis de experiência

```
NÍVEL 1 — EU CANTO   →   NÍVEL 2 — EU VOTO   →   NÍVEL 3 — EU FAÇO PARTE
```

O participante deve ter motivos para continuar usando o app **mesmo quando não está cantando**.

## Métrica principal

Não é "número de músicas cantadas". É **participação por usuário por sessão**: a pessoa
entrou, votou, acompanhou, cantou e **voltou**?

## Princípios de produto

- **Reconhecimento, não humilhação.** A gamificação celebra quem participou.
- **Nunca expor publicamente:** notas individuais negativas, quem ficou em último, votos
  individuais, avaliações negativas associadas a nome. Sempre resultados **agregados**.
- A interface deve parecer moderna, tecnológica, divertida, social e cultural — **não**
  app bancário, ERP, cassino ou app infantil.

## Primeiro tenant

**Armazém Anita** (Porto Alegre/RS) é o primeiro `venue`. A arquitetura é multi-tenant desde
o início — Anita entra como _seed_, nunca hardcode. O produto pertence à Just Go.

## Escopo do MVP

**Faz:** QR → cadastro → sessão → **pedir música (texto livre)** → fila → ser chamado →
cantar → votação 60s → resultado → XP → ranking. Host controla tudo; telão mostra o
espetáculo em tempo real.

**Vídeo da música (FASE 10):** não há catálogo curado — o participante digita o que quer
cantar e o host acha o vídeo de karaokê no YouTube (`"<nome> karaokê"`) e joga no telão
via `<iframe>` embed ao chamar. O mesmo mecanismo serve de "modo DJ" pro host animar a
casa entre apresentações (YouTube no telão; Spotify por deep-link no app dele). Sem
YouTube Data API — o host cola o link, sem cota nem custo.

**Não faz no MVP (seção 60):** rede social completa, chat/DM, upload de músicas, streaming
próprio, catálogo/curadoria de músicas, processamento de voz, IA de avaliação,
reconhecimento facial, marketplace, sistema financeiro.

**Direitos autorais:** o `<iframe>` embed é o uso público padrão do YouTube (contadores e
monetização do vídeo seguem valendo). Isso **não** substitui a licença de execução
pública de música (ECAD, no Brasil) — essa é responsabilidade do estabelecimento, não do
software.

## Critério de sucesso

O MVP está funcional quando o fluxo completo do participante, do host e do telão ocorre de
ponta a ponta, em tempo real, numa sessão real do Armazém Anita.
