CONTEXTO DO PRODUTO
Just Go Karaoke é uma plataforma social de karaokê da Just Go Smart Access, testada
ao vivo no bar Armazém Anita (Porto Alegre/RS). Não é uma fila de karaokê comum: é
uma experiência social com votação ao vivo, XP e badges, telão público e um host
que conduz a noite como um DJ. O produto já está em produção (PWA React + Supabase),
mas o visual atual é um MVP minimalista (dark navy/azul, sem QR code, sem animação).
Este prompt pede um REDESIGN completo do frontend — mantendo o fluxo de dados e as
telas descritas abaixo, mas elevando o visual ao padrão dos melhores karaokês (salas
de KTV, karaoke bars) e apps de karaokê social (Smule, Karafun), com muito mais
energia, luz de palco, neon e celebração.

Marca a manter como âncora (pode evoluir, não descartar): azul primário #01ADEF,
navy profundo #001624, tipografia display Space Grotesk. Tema escuro por padrão
(ambiente de bar/balada). Acentos livres: dourado/spotlight para prêmios e
holofotes, magenta/rosa neon (#F43F5E) para energia e chamadas de votação.

TELAS A PROJETAR (nesta ordem de prioridade)

1) TELA DO HOST — "Cabine de DJ" (desktop/tablet, uso ao vivo durante o evento)
Deve parecer o painel de controle de um DJ de verdade, não um CRUD administrativo.
Elementos obrigatórios:
- Cabeçalho da sessão: código de 6 dígitos em destaque, status (Agendada/Aberta/
  Ao vivo/Encerrada), QR code em miniatura (clicável para ampliar), contador de
  participantes conectados.
- Painel "No ar agora": nome de quem está cantando, música (texto livre digitado
  pelo participante), campo para colar/buscar o link do vídeo de karaokê no
  YouTube, thumbnail de preview do vídeo, controles de transporte grandes e
  táteis (Play, Pause, Pular, Trocar vídeo, Começou a cantar, Iniciar votação,
  Cancelar).
- Módulo "Modo DJ": liga/desliga música de fundo tocando no telão nos intervalos
  entre cantores, com campo de busca/link e atalhos para abrir busca no YouTube
  e no Spotify.
- Fila de espera: lista dos próximos cantores (nome + música), botão de chamar
  o próximo e remover alguém.
- Painel de votação/resultado ao vivo: contagem regressiva de 60s durante a
  votação; ao final, "Nota da Plateia" com médias por categoria (Voz,
  Performance, Carisma, Diversão) e % "cantaria junto".
- Central de CTAs para o telão: grade de botões grandes e chamativos que o host
  aperta para projetar um chamado no telão — ex.: "Escaneie o QR", "Peça sua
  música", "Vote agora", "Quem canta a próxima?", "Comemore com a gente". Cada
  botão deve sugerir visualmente que "dispara" algo no telão (metáfora de
  holofote/transmissão ao vivo).
- Botão dedicado e visualmente separado dos outros CTAs: "Mostrar ranking no
  telão" — deixa claro que o ranking só aparece quando o host decide, nunca
  fica exposto o tempo todo.
- Botão "Anunciar Performance da Noite" ao encerrar a sessão, com confirmação.
- Controles de ciclo de vida da sessão (Abrir / Ao vivo / Encerrar / Nova
  sessão).
Tom visual: console de estúdio — texturas escuras, luzes indicadoras, alto
contraste, tipografia técnica (monoespaçada) para números e timers, mas com o
mesmo calor do karaokê — nunca deve parecer um dashboard financeiro.

2) TELA DE APRESENTAÇÃO — "Telão" (projeção pública 16:9, visão do público e de
quem está cantando ao mesmo tempo)
Precisa de estados distintos e transições entre eles:
(a) Espera/lobby (antes de alguém cantar, ou entre uma música e outra): QR code
    GRANDE e permanente com "aponte a câmera e entre na roda" + código da
    sessão em destaque + nome do local + espaço reservado para o banner de CTA
    do host.
(b) Cantando: o vídeo do YouTube domina quase 100% da tela (é ele que carrega
    a letra) — nome do cantor e música em uma faixa fina e elegante (topo ou
    rodapé, sobreposta, nunca um bloco opaco grande); QR code permanece como
    selo discreto num canto, sempre visível mas nunca atrapalhando a leitura
    da letra.
(c) Votação: contagem regressiva de 60s em destaque, nome de quem está sendo
    avaliado, categorias sendo votadas — estética de "hora de decidir" (spot
    de luz, urgência).
(d) Resultado da votação: "Nota da Plateia" em destaque, com animação de
    revelação.
(e) Ranking — SÓ aparece quando o host aciona o botão correspondente (nunca
    automático ou contínuo): leaderboard em tela cheia, top 5, XP, badges,
    animação de entrada tipo "hall da fama".
(f) CTA do host: quando ele aciona um dos botões de chamada, aparece como um
    banner/overlay chamativo e temporário sobre o que estiver na tela
    (inclusive sobre o vídeo, sem obstruir) — como um "toast" gigante de
    palco, neon pulsante, que desaparece sozinho.
(g) Prêmio (Performance da Noite): reveal dourado dramático, confete, nome do
    vencedor em destaque.
Tom visual: iluminação de palco, feixes de luz, painel de LED — precisa ser
legível a distância (tipografia grande, altíssimo contraste). Esta é a vitrine
do produto: precisa parecer um karaokê profissional de verdade, não uma tela
de administração.

3) TELAS DO PARTICIPANTE (mobile, PWA — prioridade secundária)
- Entrar via QR/código (a leitura do QR leva direto para cá).
- Cadastro rápido (nome + WhatsApp).
- Pedir música (campo de texto livre — não há catálogo, é assim mesmo).
- Fila ao vivo (posição, cancelar).
- Votação (4 categorias 1-5 + toggle "cantaria junto", timer de 60s).
- Perfil (XP total, badges, ranking da sessão).
Tom visual: extensão mobile da mesma identidade — botões grandes, pensados
para uso em ambiente de bar, pouca luz, com o celular numa mão só.

PRINCÍPIOS DE DIREÇÃO DE ARTE
- Estudar a linguagem visual de karaokês de verdade (salas de KTV, karaoke
  bars, letreiros de neon, holofotes giratórios, bola de espelhos) e de apps
  de karaokê social (Smule, Karafun, RedKaraoke) — trazer gradientes vibrantes
  (azul-magenta ou azul-dourado), feixes de luz/spotlight, partículas/confete
  em momentos de celebração, e o microfone como elemento gráfico recorrente
  (não como emoji literal).
- Manter #01ADEF e #001624 como âncora de marca; dourado para prêmio/ranking;
  magenta/rosa neon para votação e urgência — cor com função semântica, não
  decoração aleatória.
- Alto contraste e tipografia grande em tudo que for para o telão — será visto
  a 5-10 metros de distância, com pouca luz ambiente.
- Micro-interações: pulso de neon nos botões de CTA; efeito de "transmissão"
  quando o host dispara algo pro telão; confete e brilho dourado no anúncio de
  prêmio; onda sonora animada enquanto alguém canta.
- Evitar qualquer estética corporativa, bancária ou infantil — público adulto,
  em ambiente de bar/balada, celebrando.

SISTEMA DE DESIGN A REUTILIZAR/EVOLUIR
- Fonte de destaque: Space Grotesk (já usada no produto). Fonte de apoio:
  escolher uma sans confortável para textos longos e mobile.
- Botões arredondados (pill-shaped, como hoje), com estados visuais mais ricos
  (glow, disabled, loading).
- Cards com cantos grandes, fundo escuro translúcido tipo "glass", brilho de
  borda.
- Paleta base (hex reais do produto): navy #001624, #09161E, #0D212E, #143143;
  azul #01ADEF, #1BBFFE, #43CAFE; energia #F43F5E, #FB7185; spotlight #F59E0B,
  #FBBF24; texto claro #F8F8FC; texto secundário #9A9AB0.

ENTREGÁVEIS ESPERADOS
- Alta fidelidade para: Tela do Host (desktop, com cantor ativo + votação
  ativa), Telão em pelo menos 4 estados (lobby com QR, cantando, votação,
  ranking, prêmio), e o fluxo mobile do participante (entrar, pedir música,
  fila, votar, perfil).
- Um protótipo navegável mostrando a transição entre os estados do telão e a
  relação entre o botão do host e o efeito correspondente no telão (ex.:
  clicar "Mostrar ranking" no protótipo do Host deve levar ao frame de
  ranking do Telão).
- Copy em português do Brasil.