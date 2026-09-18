# AJUSTE DO PROJETO EXISTENTE — KARAOKÊ BAR & MÚSICA

Faça estas alterações no projeto atual, preservando a identidade visual, os componentes, os fluxos e as funcionalidades já desenvolvidas.

NÃO recrie o projeto do zero.

O objetivo desta evolução é transformar o operador atual em um **HOST do Karaokê**, responsável não apenas pela fila de músicas, mas também por controlar o conteúdo apresentado no telão do bar.

---

# 1. NOVO CONCEITO: HOST

Substituir o conceito de "Operador" por **HOST**.

O Host é a pessoa responsável por conduzir a experiência do karaokê.

O Host deve conseguir:

* controlar a fila;
* iniciar apresentações;
* finalizar apresentações;
* pular apresentações;
* reorganizar a fila;
* visualizar o histórico;
* controlar o conteúdo exibido no telão;
* enviar chamadas para ação;
* enviar avisos;
* enviar propagandas;
* controlar temporariamente o que está sendo exibido no telão.

---

# 2. ACESSO DO HOST SEM SENHA

Alterar o fluxo de acesso do Host.

No MVP, o Host NÃO deve precisar informar senha.

Criar uma tela simples:

## "Entrar como Host"

Campo:

**Nome do Host**

Botão:

**ENTRAR NO KARAOKÊ**

Exemplo:

Nome do Host:
"Dani"

Após clicar em entrar:

→ acessar diretamente o Dashboard do Host.

IMPORTANTE:

Essa ausência de senha é uma decisão específica do MVP para facilitar a operação do evento.

Não criar autenticação complexa agora.

Entretanto, estruturar visualmente o sistema de maneira que futuramente possa receber autenticação através do Supabase Auth.

---

# 3. SUPABASE

Preparar conceitualmente o projeto para utilização do **Supabase como backend e infraestrutura da aplicação**.

NÃO é necessário implementar a integração real neste momento.

Organizar a aplicação pensando em:

Frontend
↓
API / camada de serviços
↓
Supabase
↓
PostgreSQL

Considerar futuramente entidades como:

* hosts;
* participantes;
* músicas;
* solicitações;
* fila;
* apresentações;
* histórico;
* mensagens do telão;
* campanhas publicitárias.

Evitar colocar regras de negócio diretamente nos componentes visuais.

Criar uma estrutura que permita substituir os dados mockados por Supabase posteriormente.

---

# 4. NOVA ÁREA: CONTROLE DO TELÃO

Adicionar ao Dashboard do Host uma área chamada:

## "CONTROLE DO TELÃO"

Essa área deve permitir ao Host controlar o conteúdo atualmente exibido na tela pública.

Criar um indicador:

**TELÃO ONLINE**

ou

**TELÃO OFFLINE**

Criar também uma prévia:

### PREVIEW DO TELÃO

A prévia deve representar aproximadamente o que está sendo exibido na televisão.

---

# 5. TIPOS DE CONTEÚDO PARA O TELÃO

Criar quatro categorias principais:

### 🎤 KARAOKÊ

Exibe:

* apresentação atual;
* nome do cantor;
* música;
* player;
* informações da fila.

### 📢 CHAMADA PARA AÇÃO

Utilizada para incentivar ações do público.

Exemplos:

* "PRÓXIMO CANTOR: PREPARE-SE!"
* "QUEM VAI SER O PRÓXIMO?"
* "APLAUSOS PARA ANA!"
* "ESCOLHA SUA MÚSICA E ENTRE NA FILA!"
* "MARQUE O @ DO BAR NO INSTAGRAM"
* "BEBIDA GELADA? CHAME O GARÇOM!"
* "HOJE TEM DOUBLE DE CAIPIRINHA!"

O Host deve conseguir selecionar uma chamada pré-configurada ou criar uma mensagem personalizada.

### 📣 AVISO

Utilizado para comunicação operacional.

Exemplos:

* "INTERVALO DE 10 MINUTOS"
* "O KARAOKÊ RETORNA ÀS 23H"
* "ÚLTIMA MÚSICA DA NOITE"
* "FILA ENCERRADA"
* "ATENÇÃO: PRÓXIMO CANTOR NO PALCO"

### 🖼️ PUBLICIDADE

Utilizada para exibir propaganda de:

* patrocinadores;
* parceiros;
* promoções do bar;
* eventos;
* produtos;
* ofertas;
* aniversários;
* campanhas.

---

# 6. PUBLICIDADE POR URL DE IMAGEM

Criar uma funcionalidade específica:

## "NOVA PUBLICIDADE"

Campos:

### Título da publicidade

Placeholder:

"Ex.: Happy Hour Bar & Música"

### URL da imagem

Criar um campo grande para colar uma URL.

Placeholder:

**Cole aqui o link da imagem que será exibida no telão**

Exemplo visual:

https://exemplo.com/imagem-promocao.jpg

IMPORTANTE:

Não utilizar uma URL real obrigatoriamente.

Utilizar dados mockados para demonstrar a funcionalidade.

Após inserir a URL, apresentar imediatamente uma:

## PRÉVIA DA IMAGEM

O Host deve visualizar como a publicidade ficará no telão antes de publicá-la.

Botões:

**CANCELAR**

**PUBLICAR NO TELÃO**

---

# 7. AÇÃO "ENVIAR PARA O TELÃO"

Toda mensagem, CTA, aviso ou publicidade deve possuir uma ação clara:

**EXIBIR NO TELÃO**

Quando o Host clicar:

1. confirmar a ação;
2. alterar o conteúdo atualmente exibido;
3. atualizar o Preview do Telão;
4. indicar visualmente que aquele conteúdo está ativo.

Mostrar:

**✓ CONTEÚDO EXIBIDO NO TELÃO**

---

# 8. CONTROLE DE TEMPO

Para publicidade, CTA e avisos, permitir selecionar:

### Duração

Opções:

* 10 segundos
* 15 segundos
* 30 segundos
* 60 segundos
* 2 minutos
* Até remover manualmente

Após o tempo configurado:

→ retornar automaticamente ao conteúdo anterior.

Exemplo:

Karaokê em execução

↓
Publicidade por 30 segundos

↓
Retorna automaticamente para o Karaokê.

---

# 9. BOTÃO "RETORNAR AO KARAOKÊ"

Adicionar um botão destacado:

**🎤 RETORNAR AO KARAOKÊ**

Esse botão deve permitir ao Host interromper imediatamente qualquer conteúdo promocional e devolver o telão para a apresentação atual.

---

# 10. BIBLIOTECA DE CONTEÚDOS

Criar uma pequena biblioteca no painel do Host:

## CONTEÚDOS DO TELÃO

Abas:

**Todos | CTAs | Avisos | Publicidades**

Cada conteúdo deve apresentar:

* thumbnail ou ícone;
* título;
* tipo;
* duração;
* status;
* botão "Exibir".

Para publicidade:

* mostrar thumbnail da imagem;
* título;
* URL;
* botão "Exibir".

---

# 11. CTAs PRÉ-CONFIGURADOS

Criar uma biblioteca inicial de chamadas para ação.

Utilizar pelo menos estas:

### 🎤 "QUEM VAI SER O PRÓXIMO?"

### 👏 "APLAUSOS PARA O CANTOR!"

### 🎶 "ESCOLHA SUA MÚSICA"

### 📱 "SIGA O BAR NAS REDES SOCIAIS"

### 🍻 "HORA DO HAPPY HOUR!"

### 🎂 "HOJE TEM ANIVERSARIANTE!"

### 📸 "POSTE SUA FOTO E MARQUE O BAR"

### 🔥 "BORA LOTAR ESSA FILA!"

O Host também deve poder criar uma chamada personalizada.

---

# 12. GERADOR DE CTA PERSONALIZADO

Criar um formulário:

## NOVA CHAMADA

Campo:

**Mensagem**

Textarea:

"Digite a mensagem que será exibida no telão..."

Campo:

**Duração**

Select:

10s
15s
30s
60s

Botão:

**EXIBIR NO TELÃO**

---

# 13. CONTROLE DO ESTADO DO TELÃO

No Dashboard do Host, mostrar claramente:

### AGORA NO TELÃO

Tipo:

🎤 KARAOKÊ

ou

📢 CTA

ou

📣 AVISO

ou

🖼️ PUBLICIDADE

Mostrar também:

* conteúdo atual;
* tempo restante;
* origem;
* botão "Encerrar".

Exemplo:

AGORA NO TELÃO

🖼️ PUBLICIDADE

"Happy Hour Bar & Música"

00:23 restantes

[ENCERRAR]

---

# 14. PRIORIDADE DOS CONTEÚDOS

Implementar visualmente a seguinte lógica:

### PRIORIDADE 1

Apresentação de karaokê

### PRIORIDADE 2

Aviso urgente

### PRIORIDADE 3

CTA

### PRIORIDADE 4

Publicidade

Porém, o Host pode manualmente substituir temporariamente o conteúdo do telão.

Quando o conteúdo temporário terminar:

→ retornar ao conteúdo anterior.

---

# 15. MODO "PALCO"

Criar uma experiência especial chamada:

## MODO PALCO

Essa será a tela pública exibida no telão.

Ela deve ser extremamente simples.

Quando houver apresentação:

Mostrar:

🎤 AGORA CANTANDO

NOME DO PARTICIPANTE

MÚSICA

PLAYER

PRÓXIMO:

Nome do próximo participante

Quando houver publicidade:

Mostrar somente a publicidade, ocupando a maior parte da tela.

Quando houver CTA:

Mostrar a mensagem de forma grande, centralizada e visualmente impactante.

Quando houver aviso:

Mostrar a mensagem com destaque.

O telão deve evitar excesso de informações.

---

# 16. TRANSIÇÕES

Criar transições visuais suaves entre:

Karaokê
↓
Publicidade
↓
Karaokê

Karaokê
↓
CTA
↓
Karaokê

Evitar animações excessivas.

O objetivo é parecer um sistema profissional de entretenimento, não uma apresentação de PowerPoint que descobriu o botão "transição".

---

# 17. RESPONSIVIDADE

O Dashboard do Host será utilizado principalmente em:

* notebook;
* desktop;
* tablet.

O Modo Palco será utilizado principalmente em:

* TV;
* monitor;
* projetor;
* navegador em tela cheia.

O layout do Modo Palco deve ser otimizado para 16:9.

---

# 18. ARQUITETURA DE DADOS FUTURA

Preparar conceitualmente os componentes para futuramente trabalharem com objetos semelhantes a:

Advertisement:

* id
* title
* image_url
* duration
* active
* created_at

ScreenContent:

* id
* type
* title
* content
* image_url
* duration
* priority
* active
* created_at

QueueItem:

* id
* participant
* song
* video_url
* position
* status

Não é necessário criar banco de dados agora.

Utilizar mock data.

---

# 19. EXPERIÊNCIA DO HOST

O Dashboard deve apresentar quatro grandes áreas:

## 🎤 KARAOKÊ

Controle da fila e apresentações.

## 📺 TELÃO

Controle do conteúdo exibido.

## 📣 COMUNICAÇÃO

CTAs e avisos.

## 🖼️ PUBLICIDADE

Gerenciamento das imagens e campanhas.

O Host deve conseguir executar as principais ações sem precisar navegar por muitas telas.

Priorizar operação rápida durante o evento.

---

# 20. FLUXO PRINCIPAL DO HOST

Demonstrar o seguinte fluxo:

HOST ENTRA

↓

DASHBOARD

↓

VISUALIZA FILA

↓

APRESENTAÇÃO ATUAL

↓

CONTROLE DO TELÃO

↓

ESCOLHE "PUBLICIDADE"

↓

COLOCA TÍTULO

↓

COLA URL DA IMAGEM

↓

VISUALIZA PRÉVIA

↓

DEFINE DURAÇÃO

↓

CLICA "PUBLICAR NO TELÃO"

↓

TELÃO EXIBE PUBLICIDADE

↓

CONTADOR DE TEMPO

↓

RETORNA AUTOMATICAMENTE AO KARAOKÊ

---

# 21. FLUXO DE CTA

HOST

↓

CONTROLE DO TELÃO

↓

CHAMADA PARA AÇÃO

↓

ESCOLHE CTA

↓

DEFINE DURAÇÃO

↓

EXIBIR NO TELÃO

↓

CTA APARECE

↓

RETORNO AUTOMÁTICO AO KARAOKÊ

---

# 22. OBJETIVO DA ALTERAÇÃO

O resultado deve fazer o sistema parecer menos um simples "tocador de músicas" e mais uma **plataforma de entretenimento para bares**.

O Host deve ser o centro de controle da experiência.

O telão deve funcionar como um canal de comunicação entre o bar e o público.

Preservar a simplicidade operacional.

Priorizar:

* velocidade;
* legibilidade;
* controle;
* feedback;
* poucos cliques;
* operação em ambiente de evento;
* visualização em tela grande.

Ao finalizar, revise todas as telas existentes e integre as novas funcionalidades sem quebrar os fluxos atuais.
