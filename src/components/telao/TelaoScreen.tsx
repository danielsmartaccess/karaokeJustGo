import { useEffect, useRef } from 'react';
import { Maximize2, Play } from 'lucide-react';
import { useKaraoke } from '../../store/KaraokeContext';
import type { ScreenContent } from '../../types';
import Logo from '../Logo';
import { QRCodeTelaoMode } from '../QRCodeDisplay';
import { participantUrl } from '../../lib/urls';

/**
 * Tela do telão: a ÚNICA implementação.
 *
 * Usada em dois lugares, com o mesmo código:
 *   - `tv`      a rota #/telao, que ocupa a janela inteira;
 *   - `mirror`  o espelho do painel do Host, que a renderiza numa área de
 *               1920x1080 reduzida por transform (ver TelaoMirror).
 *
 * Antes o preview do Host era uma segunda implementação, desenhada à mão em
 * miniatura, e divergia da TV em tudo: sem cabeçalho, sem contador, sem o
 * rótulo do aviso, com o título da publicidade ausente. Com uma só tela, o que
 * o Host vê é o que a TV mostra por construção.
 *
 * Os tamanhos responsivos usam consultas de CONTÊINER (@3xl = 768px,
 * @5xl = 1024px, @7xl = 1280px: os mesmos limites de md, lg e xl), medidas na
 * largura desta tela e não da janela do navegador. É isso que faz o espelho,
 * reduzido dentro de um painel pequeno, renderizar como uma TV de 1920px.
 *
 * A única diferença do espelho é o vídeo: não abre um segundo player do
 * YouTube (consumiria a internet do bar junto com a TV e tocaria áudio no
 * notebook), então mostra a miniatura da música no lugar do player.
 */

export type TelaoVariant = 'tv' | 'mirror';

// --- Karaokê ---
function KaraokeMode({ variant }: { variant: TelaoVariant }) {
  const { state } = useKaraoke();
  const { currentPlaying } = state;
  const containerRef = useRef<HTMLDivElement>(null);
  const isTv = variant === 'tv';

  // Tela cheia ao trocar de apresentacao. O navegador recusa sem gesto do
  // usuario, entao o botao manual abaixo continua sendo o caminho garantido.
  const playingId = currentPlaying?.id ?? null;
  useEffect(() => {
    if (!isTv || !playingId) return;
    const el = containerRef.current ?? document.documentElement;
    el.requestFullscreen?.().catch(() => {});
  }, [isTv, playingId]);

  const handleFullscreen = () => {
    const el = containerRef.current ?? document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  };

  if (!currentPlaying) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="text-8xl mb-6 opacity-20">🎤</div>
        <h1 className="text-5xl @3xl:text-6xl font-display font-bold text-slate-700 mb-3">
          Aguardando início
        </h1>
        <p className="text-slate-700 text-2xl">Nenhuma apresentação em andamento</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-h-0 relative bg-black">
      {/* Video */}
      <div className="flex-1 relative min-h-0">
        {isTv ? (
          <iframe
            src={`https://www.youtube.com/embed/${currentPlaying.song.youtubeId}?rel=0&modestbranding=1&iv_load_policy=3&autoplay=1&fs=1`}
            title={`${currentPlaying.song.title} — ${currentPlaying.song.artist}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <>
            <img
              src={currentPlaying.song.thumbnail}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-44 h-32 rounded-3xl bg-red-600/90 flex items-center justify-center text-white">
                <Play className="w-16 h-16" fill="currentColor" />
              </span>
            </div>
          </>
        )}
      </div>

      {/* Participant identity — bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-8 pt-16 pb-8 pointer-events-none">
        <span className="block text-xs font-mono tracking-[0.35em] text-pink-400 uppercase mb-2 neon-text-pink">
          ▶ Agora Cantando
        </span>
        <h1 className="text-4xl @3xl:text-6xl @7xl:text-7xl font-display font-black text-white leading-none break-words gradient-title">
          {currentPlaying.participant}
        </h1>
        <div className="flex items-baseline gap-3 mt-2">
          <h2 className="text-xl @3xl:text-2xl font-display font-semibold text-pink-300 leading-tight">
            {currentPlaying.song.title}
          </h2>
          <span className="text-slate-500 text-base @3xl:text-lg">
            {currentPlaying.song.artist}
          </span>
        </div>
      </div>

      {/* Manual fullscreen toggle (inerte no espelho: é só parte da imagem) */}
      <button
        onClick={handleFullscreen}
        tabIndex={isTv ? 0 : -1}
        aria-hidden={isTv ? undefined : true}
        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 text-white/60 hover:text-white rounded-lg transition-all backdrop-blur-sm"
        title="Tela cheia"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// --- CTA mode ---
function CTAMode({ content }: { content: ScreenContent }) {
  const emoji = content.content?.split(' ')[0] ?? '📢';
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-12 py-16 bg-[#06000e]">
      <div className="text-7xl @3xl:text-9xl mb-8 animate-[pulse_2s_ease-in-out_infinite]">
        {emoji}
      </div>
      <h1 className="text-4xl @3xl:text-6xl @5xl:text-7xl @7xl:text-8xl font-display font-black text-white leading-none tracking-tight gradient-title max-w-4xl">
        {content.title}
      </h1>
      <div
        className="mt-10 w-24 h-1 rounded-full neon-glow-pink"
        style={{ background: '#e91e8c' }}
      />
    </div>
  );
}

// --- Notice mode ---
function NoticeMode({ content }: { content: ScreenContent }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-12 py-16 bg-[#06000e]">
      <div className="w-20 h-20 bg-amber-500/20 border-2 border-amber-500/50 rounded-full flex items-center justify-center mb-8">
        <span className="text-4xl">📣</span>
      </div>
      <div className="text-xs font-mono text-amber-500 tracking-[0.4em] uppercase mb-6">Aviso</div>
      <h1
        className="text-4xl @3xl:text-6xl @5xl:text-7xl font-display font-black text-amber-400 leading-tight max-w-4xl"
        style={{ textShadow: '0 0 30px rgba(245, 158, 11, 0.5), 0 0 60px rgba(245, 158, 11, 0.2)' }}
      >
        {content.title}
      </h1>
    </div>
  );
}

// --- Ad mode ---
function AdMode({ content }: { content: ScreenContent }) {
  return (
    <div className="flex-1 relative overflow-hidden">
      {content.imageUrl && (
        <img
          src={content.imageUrl}
          alt={content.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-10 py-8">
        <p className="text-xs font-mono text-pink-400 tracking-widest mb-2 uppercase">
          Publicidade
        </p>
        <h2 className="text-2xl @3xl:text-4xl font-display font-black text-white">
          {content.title}
        </h2>
      </div>
    </div>
  );
}

// --- QR Code mode ---
function QRCodeMode() {
  return <QRCodeTelaoMode url={participantUrl()} />;
}

// --- Countdown badge ---
function CountdownBadge({ seconds }: { seconds: number }) {
  const pct = Math.min(seconds / 120, 1);
  return (
    <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-black/60 border border-slate-700 rounded-xl px-4 py-2.5 backdrop-blur-sm z-20">
      <div className="relative w-4 h-4">
        <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="2" />
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke="#e91e8c"
            strokeWidth="2"
            strokeDasharray={`${pct * 37.7} 37.7`}
            className="transition-all duration-1000"
          />
        </svg>
      </div>
      <span className="text-pink-400 font-mono text-sm">{seconds}s</span>
    </div>
  );
}

// --- Main ---
export function TelaoScreen({ variant = 'tv' }: { variant?: TelaoVariant }) {
  const { state } = useKaraoke();
  const { currentContent = null, timeRemaining = null, isOnline = true } = state.telao ?? {};

  const contentKey = currentContent?.id ?? 'karaoke';
  const contentType = currentContent?.type ?? 'karaoke';
  // A TV ocupa a janela; o espelho preenche a área de projeto que o contém.
  const height = variant === 'tv' ? 'min-h-screen' : 'h-full';

  if (!isOnline) {
    return (
      <div
        data-testid="telao-screen"
        className={`${height} bg-[#06000e] flex flex-col items-center justify-center pb-20`}
      >
        <div className="text-6xl mb-6 opacity-20">📺</div>
        <h1 className="text-4xl font-display font-bold text-slate-700">Telão Offline</h1>
        <p className="text-slate-700 mt-3">O telão está desconectado pelo Host.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="telao-screen"
      className={`@container ${height} bg-[#06000e] flex flex-col overflow-hidden pb-20 scanlines relative`}
    >
      {/* Header — hidden in ad/qrcode full modes */}
      {contentType !== 'ad' && (
        <header className="flex items-center justify-between px-8 py-5 border-b border-pink-900/20 shrink-0 relative z-10">
          <Logo size="md" />
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 font-mono text-sm tracking-widest">AO VIVO</span>
          </div>
        </header>
      )}

      {/* Content with transition */}
      <div key={contentKey} className="flex-1 flex flex-col telao-enter min-h-0 relative z-10">
        {contentType === 'karaoke' && <KaraokeMode variant={variant} />}
        {contentType === 'cta' && currentContent && <CTAMode content={currentContent} />}
        {contentType === 'notice' && currentContent && <NoticeMode content={currentContent} />}
        {contentType === 'ad' && currentContent && <AdMode content={currentContent} />}
        {contentType === 'qrcode' && <QRCodeMode />}
      </div>

      {timeRemaining !== null && timeRemaining > 0 && <CountdownBadge seconds={timeRemaining} />}
    </div>
  );
}
