# PROJETO: SISTEMA DE KARAOKÊ PARA BAR

Você é um UX/UI Designer e Product Designer responsável por transformar uma especificação de produto em um protótipo funcional de alta fidelidade.

Crie o FRONT-END de um MVP de um sistema de karaokê para um bar chamado **Bar & Música**.

O objetivo é criar uma experiência simples, divertida e muito fácil de operar durante uma noite de karaokê.

IMPORTANTE:

* Não implemente backend real.
* Não implemente banco de dados.
* Não implemente autenticação real.
* Não implemente integração real com APIs neste momento.
* Utilize dados mockados para simular o comportamento da aplicação.
* Estruture o front-end de maneira que posteriormente possa ser conectado a uma API.
* O sistema deverá utilizar o YouTube como fonte de vídeos no MVP.
* Não faça download de vídeos.
* Não implemente ainda o agente de IA que futuramente poderá gerar conteúdos de karaokê.
* Considere essa futura integração apenas como uma possibilidade arquitetural.

---

## 1. CONCEITO DO PRODUTO

O sistema possui três experiências principais:

### A. Tela do participante

Utilizada pelo cliente do bar para pesquisar uma música e entrar na fila.

### B. Tela da fila

Exibida em uma TV ou monitor do estabelecimento, permitindo que todos acompanhem a apresentação atual e as próximas.

### C. Painel do operador

Utilizado pelo funcionário responsável pelo karaokê para controlar a fila e as apresentações.

---

# 2. EXPERIÊNCIA DO PARTICIPANTE

Criar uma tela inicial chamada:

**"Escolha sua música"**

Elementos:

* logotipo/nome Bar & Música;
* campo de busca;
* botão "Buscar";
* indicação "Pesquise por música ou artista";
* lista de resultados.

Cada resultado deve apresentar:

* thumbnail;
* título da música;
* artista;
* duração;
* botão "Cantar".

Exemplo de dados:

* Bruno Mars — Locked Out of Heaven
* The Weeknd — Blinding Lights
* Dua Lipa — Houdini
* Queen — Don't Stop Me Now
* Imagine Dragons — Believer

Ao clicar em "Cantar":

abrir modal:

**"Quem vai cantar?"**

Campo:

"Digite seu nome ou apelido"

Botão:

"Entrar na fila"

Após confirmação:

mostrar tela de sucesso:

**"Você está na fila!"**

Exibir:

* nome do participante;
* música;
* posição na fila;
* quantidade aproximada de apresentações antes da sua;
* mensagem de incentivo.

Exemplo:

"Você é o 5º da fila."

Botão:

"Ver fila"

---

# 3. TELA DA FILA

Criar uma tela própria para ser exibida em uma TV.

Layout visual de grande impacto.

Mostrar:

## AGORA CANTANDO

Nome do participante

Título da música

Área grande reservada para o player do YouTube.

Abaixo:

## PRÓXIMOS

Lista das próximas apresentações:

1. Ana — Evidências
2. Carlos — Livin' on a Prayer
3. Julia — Perfect
4. Marcos — Sweet Child O' Mine

A interface deve ser legível a vários metros de distância.

Utilizar tipografia grande, alto contraste e poucos elementos.

---

# 4. PAINEL DO OPERADOR

Criar uma área administrativa chamada:

**"Controle do Karaokê"**

O painel deve possuir:

### Cabeçalho

* Bar & Música
* status do sistema
* usuário operador

### Card da apresentação atual

Mostrar:

* participante;
* música;
* vídeo;
* horário de início;
* status "EM EXECUÇÃO".

Botões:

* "Finalizar"
* "Pular"
* "Interromper"

### Fila

Criar tabela/lista contendo:

* posição;
* participante;
* música;
* horário da solicitação;
* status;
* ações.

Ações:

* iniciar;
* mover para cima;
* mover para baixo;
* cancelar.

### Histórico

Criar seção contendo:

* participante;
* música;
* horário;
* duração;
* resultado/status.

---

# 5. ESTADOS DA INTERFACE

O protótipo deve representar visualmente os seguintes estados:

* Nenhuma música em execução;
* Pesquisa sem resultados;
* Resultados encontrados;
* Música selecionada;
* Solicitação confirmada;
* Participante aguardando;
* Próximo da fila;
* Apresentação em execução;
* Apresentação finalizada;
* Apresentação cancelada;
* Vídeo indisponível;
* Erro de conexão;
* Fila vazia.

---

# 6. REGRAS DE NEGÓCIO A SEREM REFLETIDAS NA INTERFACE

O front-end deve respeitar estas regras:

1. Uma solicitação somente entra na fila após confirmação.
2. Toda solicitação possui um participante.
3. Apenas uma apresentação pode estar em execução.
4. Participantes não podem alterar a ordem da fila.
5. O operador pode alterar a ordem da fila.
6. O operador pode cancelar uma solicitação.
7. Uma apresentação finalizada sai da fila de pendentes.
8. Uma apresentação cancelada deve aparecer no histórico.
9. Um vídeo indisponível não pode ser iniciado.
10. O sistema deve fornecer feedback após ações importantes.
11. A fila deve possuir uma ordem claramente visível.
12. A interface deve diferenciar visualmente "Agora", "Próximo" e "Aguardando".

---

# 7. ARQUITETURA DE TELAS

Crie as seguintes telas:

1. Home / Busca
2. Resultados da busca
3. Confirmação da música
4. Participante entrou na fila
5. Visualização da fila
6. Tela pública "Agora Cantando"
7. Login do operador
8. Dashboard do operador
9. Controle da apresentação
10. Gerenciamento da fila
11. Histórico
12. Estados de erro

Criar navegação coerente entre todas elas.

---

# 8. DIREÇÃO VISUAL

Criar uma identidade visual inspirada em:

* bar;
* música;
* palco;
* neon;
* entretenimento;
* noite.

A interface deve transmitir energia e diversão sem parecer um aplicativo infantil.

Utilizar:

* fundo predominantemente escuro;
* alto contraste;
* elementos luminosos;
* cards;
* botões grandes;
* ícones claros;
* tipografia moderna;
* hierarquia visual forte.

Não exagerar nos efeitos.

O sistema precisa parecer um produto real que poderia ser utilizado em um bar.

---

# 9. RESPONSIVIDADE

Criar layouts para:

### Desktop

Uso do operador.

### Tablet

Uso pelos clientes.

### TV / tela grande

Visualização da fila e apresentação.

A experiência de TV deve possuir elementos muito maiores e simplificados.

---

# 10. COMPONENTES

Criar componentes reutilizáveis:

* SearchBar
* SongCard
* QueueItem
* QueuePosition
* NowPlaying
* NextSong
* Player
* StatusBadge
* PrimaryButton
* SecondaryButton
* ConfirmationModal
* ErrorMessage
* EmptyState
* OperatorDashboard
* HistoryTable

Utilizar componentes consistentes em todas as telas.

---

# 11. DADOS MOCKADOS

Utilizar dados fictícios para demonstrar o sistema.

Criar pelo menos 10 músicas e 8 participantes.

Exemplo:

Participante: Ana
Música: Evidências

Participante: Carlos
Música: Livin' on a Prayer

Participante: Julia
Música: Perfect

Participante: Marcos
Música: Sweet Child O' Mine

Participante: Fernanda
Música: Someone Like You

Participante: Rafael
Música: Don't Stop Me Now

Participante: Lucas
Música: Blinding Lights

Participante: Camila
Música: Houdini

---

# 12. INTERAÇÃO

O protótipo deve permitir demonstrar o seguinte fluxo:

BUSCAR MÚSICA
↓
VISUALIZAR RESULTADOS
↓
SELECIONAR MÚSICA
↓
INFORMAR NOME
↓
CONFIRMAR
↓
ENTRAR NA FILA
↓
VISUALIZAR POSIÇÃO
↓
AGUARDAR
↓
SER O PRÓXIMO
↓
INICIAR APRESENTAÇÃO
↓
FINALIZAR
↓
REGISTRAR NO HISTÓRICO

Também demonstrar o fluxo alternativo:

SELECIONAR MÚSICA
↓
VÍDEO INDISPONÍVEL
↓
EXIBIR ERRO
↓
PERMITIR ESCOLHER OUTRO VÍDEO

---

# 13. PREPARAÇÃO PARA FUTURA EVOLUÇÃO

A aplicação deverá ser visualmente preparada para uma futura arquitetura em que o sistema poderá possuir diferentes fontes de conteúdo.

Representar conceitualmente:

Fonte atual:
YouTube

Futuras fontes possíveis:

* catálogo próprio;
* arquivos autorizados;
* serviço de geração de karaokê;
* agente de IA.

Não implementar essas fontes agora.

A interface deve evitar ficar fortemente acoplada ao conceito de "vídeo do YouTube".

---

# 14. OBJETIVO DO PROTÓTIPO

O resultado deve permitir que um professor apresente o projeto aos alunos e consiga demonstrar:

* problema de negócio;
* atores;
* requisitos;
* regras de negócio;
* jornada do usuário;
* arquitetura de telas;
* estados do sistema;
* interação;
* responsividade;
* preparação para evolução tecnológica.

Priorize clareza da experiência e qualidade da interface.

O resultado deve parecer um **MVP real de um produto SaaS para bares**, e não apenas um exercício visual.

Antes de finalizar, verifique se todos os fluxos principais possuem uma tela correspondente e se os estados de erro e exceção também estão representados.
