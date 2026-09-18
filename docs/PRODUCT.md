# PRODUCT — Karaokê Just Go

## Visão

Não é um tocador de músicas com fila. É uma **plataforma de entretenimento para bares**, em
que o telão vira canal de comunicação entre a casa e o público, e o Host é o centro de
controle da noite.

O karaokê é a atração. A operação da noite é o produto.

## Problema de negócio

Uma noite de karaokê em bar costuma ser operada no grito e no papel: alguém anota nomes numa
lista, o telão só toca vídeo, e o bar não tem como falar com a plateia sem interromper a
apresentação. Resultado: fila confusa, cliente sem previsibilidade, e zero aproveitamento
comercial do telão entre uma música e outra.

## Atores

| Ator             | Onde opera            | O que faz                                                           |
| ---------------- | --------------------- | ------------------------------------------------------------------- |
| **Participante** | Celular               | Busca a música, escolhe a versão karaokê e pede para entrar na fila |
| **Host**         | Notebook ou tablet    | Aprova solicitações, conduz a fila e comanda o telão                |
| **Telão**        | TV, monitor, projetor | Exibe a apresentação, chamadas, avisos, publicidade e o QR code     |

## As três experiências

### Participante (`#/`)

Busca uma versão karaokê (YouTube Data API quando configurada, catálogo de demonstração caso
contrário), escolhe o vídeo, informa nome e WhatsApp opcional, e envia a solicitação. A
solicitação nasce **pendente**: quem decide é o Host.

### Modo Palco (`#/telao`)

Tela pública, otimizada para 16:9 e leitura a vários metros. Exibe um de cinco conteúdos:
apresentação de karaokê, chamada para ação, aviso, publicidade ou QR code de entrada.

### Host (`#/host`)

Painel com quatro áreas: **Karaokê** (fila, apresentação atual e histórico), **Telão**
(status, preview e retorno ao karaokê), **Comunicação** (CTAs e avisos) e **Publicidade**
(campanhas por URL de imagem).

## Regras de negócio

Implementadas em [`src/store/reducer.ts`](../src/store/reducer.ts) e verificadas em
[`tests/unit/`](../tests/unit/).

1. Uma solicitação só entra na fila após o Host aprovar.
2. Toda solicitação tem um participante identificado.
3. Apenas uma apresentação pode estar em execução por sala. O banco garante isso com um
   índice único parcial.
4. Participantes não alteram a ordem da fila. Só o Host.
5. O Host reordena e cancela solicitações.
6. Apresentação finalizada sai da fila e entra no histórico como concluída.
7. Apresentação pulada ou cancelada entra no histórico como cancelada.
8. A ordem da fila é sempre visível, e o primeiro da fila é marcado como próximo.
9. A interface diferencia visualmente "agora", "próximo" e "aguardando".

## Prioridade do telão

O karaokê é o conteúdo de base. O Host pode sobrepor temporariamente:

| Prioridade | Conteúdo          | Comportamento                         |
| ---------- | ----------------- | ------------------------------------- |
| 1          | Apresentação      | Estado padrão do telão                |
| 2          | Aviso             | Sobrepõe; volta ao karaokê ao expirar |
| 3          | Chamada para ação | Sobrepõe; volta ao karaokê ao expirar |
| 4          | Publicidade       | Sobrepõe; volta ao karaokê ao expirar |

Durações disponíveis: 10s, 15s, 30s, 1min, 2min ou até o Host remover manualmente. O retorno
é automático — o telão não fica preso em um banner porque alguém esqueceu de encerrar.

O tempo restante é calculado a partir do instante de expiração, não por decremento. Assim
telão, celular e painel convergem para o mesmo número sem escrever no banco a cada segundo.

## Estados representados na interface

Nenhuma música em execução · pesquisa sem resultados · resultados encontrados · música
selecionada · solicitação enviada · aguardando aprovação · participante na fila · próximo da
fila · apresentação em execução · finalizada · cancelada · vídeo indisponível · telão offline
· sem conexão · fila vazia.

## Fontes de conteúdo

Hoje: **YouTube**. A interface fala em "versão karaokê", não em "vídeo do YouTube", para não
acoplar o produto à fonte atual. Evoluções previstas: catálogo próprio, arquivos autorizados,
serviço de geração de karaokê e agente de IA. Nenhuma implementada.

## Fora de escopo neste MVP

- Autenticação real (ver [`SECURITY.md`](./SECURITY.md)).
- Votação da plateia, gamificação e reputação — existiam no produto anterior e foram
  descontinuadas.
- Download de vídeos.
- Notificação por WhatsApp. O telefone é coletado, mas ainda não é usado.
