import React, { useEffect, useRef } from 'react';
import { useKaraoke } from '../store/KaraokeContext';
import { ScreenContent } from '../types';
import Logo from '../components/Logo';
import { QRCodeTelaoMode } from '../components/QRCodeDisplay';
import { Maximize2 } from 'lucide-react';

// --- Karaokê mode ---
function KaraokeMode() {
  const { state } = useKaraoke();
  const { currentPlaying } = state;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentPlaying) return;
    const el = containerRef.current ?? document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }, [currentPlaying?.id]);

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
        <h1 className="text-5xl md:text-6xl font-display font-bold text-slate-700 mb-3">
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
        <iframe
          src={`https://www.youtube.com/embed/${currentPlaying.song.youtubeId}?rel=0&modestbranding=1&iv_load_policy=3&autoplay=1&fs=1`}
          title={`${currentPlaying.song.title} — ${currentPlaying.song.artist}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>

      {/* Participant identity — bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-8 pt-16 pb-8 pointer-events-none">
        <span className="block text-xs font-mono tracking-[0.35em] text-pink-400 uppercase mb-2 neon-text-pink">
          ▶ Agora Cantando
        </span>
        <h1 className="text-4xl md:text-6xl xl:text-7xl font-display font-black text-white leading-none break-words gradient-title">
          {currentPlaying.participant}
        </h1>
        <div className="flex items-baseline gap-3 mt-2">
          <h2 className="text-xl md:text-2xl font-display font-semibold text-pink-300 leading-tight">
            {currentPlaying.song.title}
          </h2>
          <span className="text-slate-500 text-base md:text-lg">{currentPlaying.song.artist}</span>
        </div>
      </div>

      {/* Manual fullscreen toggle */}
      <button
        onClick={handleFullscreen}
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
      <div className="text-7xl md:text-9xl mb-8 animate-[pulse_2s_ease-in-out_infinite]">{emoji}</div>
      <h1 className="text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-display font-black text-white leading-none tracking-tight gradient-title max-w-4xl">
        {content.title}
      </h1>
      <div className="mt-10 w-24 h-1 rounded-full neon-glow-pink" style={{ background: '#e91e8c' }} />
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
        className="text-4xl md:text-6xl lg:text-7xl font-display font-black text-amber-400 leading-tight max-w-4xl"
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
        <img src={content.imageUrl} alt={content.title} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-10 py-8">
        <p className="text-xs font-mono text-pink-400 tracking-widest mb-2 uppercase">Publicidade</p>
        <h2 className="text-2xl md:text-4xl font-display font-black text-white">{content.title}</h2>
      </div>
    </div>
  );
}

// --- QR Code mode ---
function QRCodeMode() {
  const sessionUrl = window.location.href.split('?')[0];
  return <QRCodeTelaoMode url={sessionUrl} />;
}

// --- Countdown badge ---
function CountdownBadge({ seconds }: { seconds: number }) {
  const pct = Math.min(seconds / 120, 1);
  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-black/60 border border-slate-700 rounded-xl px-4 py-2.5 backdrop-blur-sm z-20">
      <div className="relative w-4 h-4">
        <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="2" />
          <circle cx="8" cy="8" r="6" fill="none" stroke="#e91e8c" strokeWidth="2"
            strokeDasharray={`${pct * 37.7} 37.7`} className="transition-all duration-1000" />
        </svg>
      </div>
      <span className="text-pink-400 font-mono text-sm">{seconds}s</span>
    </div>
  );
}

// --- Main ---
export default function TVQueueView() {
  const { state } = useKaraoke();
  const { currentContent = null, timeRemaining = null, isOnline = true } = state.telao ?? {};

  const contentKey = currentContent?.id ?? 'karaoke';
  const contentType = currentContent?.type ?? 'karaoke';

  if (!isOnline) {
    return (
      <div className="min-h-screen bg-[#06000e] flex flex-col items-center justify-center pb-20">
        <div className="text-6xl mb-6 opacity-20">📺</div>
        <h1 className="text-4xl font-display font-bold text-slate-700">Telão Offline</h1>
        <p className="text-slate-700 mt-3">O telão está desconectado pelo Host.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06000e] flex flex-col overflow-hidden pb-20 scanlines relative">
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
        {contentType === 'karaoke' && <KaraokeMode />}
        {contentType === 'cta' && currentContent && <CTAMode content={currentContent} />}
        {contentType === 'notice' && currentContent && <NoticeMode content={currentContent} />}
        {contentType === 'ad' && currentContent && <AdMode content={currentContent} />}
        {contentType === 'qrcode' && <QRCodeMode />}
      </div>

      {timeRemaining !== null && timeRemaining > 0 && <CountdownBadge seconds={timeRemaining} />}
    </div>
  );
}
