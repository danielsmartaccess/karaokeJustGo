import { useState, useEffect } from 'react';
import { SessionData, TelaoState, CTAMessage } from '../App';

interface Props {
  session: SessionData;
  onSetSession: (s: SessionData) => void;
  onTelaoAction: (state: TelaoState) => void;
  onCTA: (msg: CTAMessage) => void;
  telaoState: TelaoState;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#9A9AB0',
  open: '#01ADEF',
  live: '#F43F5E',
  ended: '#F59E0B',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  open: 'Aberta',
  live: 'Ao vivo',
  ended: 'Encerrada',
};

export default function HostScreen({ session, onSetSession, onTelaoAction, onCTA, telaoState }: Props) {
  const [isVoting, setIsVoting] = useState(false);
  const [voteCountdown, setVoteCountdown] = useState(60);
  const [videoLink, setVideoLink] = useState('');
  const [djModeLink, setDjModeLink] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<string | null>(null);
  const [showPrizeConfirm, setShowPrizeConfirm] = useState(false);

  useEffect(() => {
    if (!isVoting) return;
    if (voteCountdown <= 0) {
      setIsVoting(false);
      onTelaoAction('result');
      return;
    }
    const t = setTimeout(() => setVoteCountdown(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [isVoting, voteCountdown, onTelaoAction]);

  const startVoting = () => {
    setIsVoting(true);
    setVoteCountdown(60);
    onTelaoAction('voting');
  };

  const broadcast = (msg: CTAMessage, label: string) => {
    onCTA(msg);
    setBroadcastFeedback(label);
    setTimeout(() => setBroadcastFeedback(null), 2500);
  };

  const callNext = () => {
    const [next, ...rest] = session.queue;
    if (!next) return;
    onSetSession({
      ...session,
      currentSinger: { ...session.currentSinger, name: next.name, song: next.song },
      queue: rest,
    });
    onTelaoAction('singing');
  };

  const removeFromQueue = (id: string) => {
    onSetSession({ ...session, queue: session.queue.filter(q => q.id !== id) });
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=https://justgokaraoke.app/s/${session.code}&color=01ADEF&bgcolor=001624`;
  const qrUrlLarge = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=https://justgokaraoke.app/s/${session.code}`;

  return (
    <div
      className="min-h-screen p-4"
      style={{ background: 'linear-gradient(135deg, #001624 0%, #09161E 60%, #0D212E 100%)' }}
    >
      {/* Session header */}
      <div className="glass rounded-2xl p-4 mb-4 flex items-center gap-5 flex-wrap">
        <div>
          <p className="text-xs text-[#9A9AB0] mb-1 tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            SESSÃO
          </p>
          <p
            className="text-4xl font-bold tracking-[0.25em] text-[#01ADEF]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {session.code}
          </p>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: `${STATUS_COLORS[session.status]}18`, border: `1px solid ${STATUS_COLORS[session.status]}40` }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: STATUS_COLORS[session.status] }}
          />
          <span
            className="text-sm font-bold"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: STATUS_COLORS[session.status] }}
          >
            {STATUS_LABELS[session.status]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#9A9AB0] text-sm">👥</span>
          <span className="text-2xl font-bold text-[#F8F8FC]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {session.participants}
          </span>
          <span className="text-[#9A9AB0] text-sm">conectados</span>
        </div>

        <button
          onClick={() => setShowQRModal(true)}
          className="hover:scale-110 transition-transform"
          title="Ampliar QR Code"
        >
          <img
            src={qrUrl}
            alt="QR Code da sessão"
            className="w-14 h-14 rounded-xl"
            style={{ border: '2px solid rgba(1,173,239,0.4)' }}
          />
        </button>

        <div className="ml-auto flex gap-2 flex-wrap">
          {(['open', 'live', 'ended'] as const).map(s => (
            <button
              key={s}
              onClick={() => onSetSession({ ...session, status: s })}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                background: session.status === s ? `${STATUS_COLORS[s]}25` : 'transparent',
                color: session.status === s ? STATUS_COLORS[s] : '#9A9AB0',
                border: `1px solid ${session.status === s ? STATUS_COLORS[s] : 'rgba(154,154,176,0.25)'}`,
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: main controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* No ar agora */}
          <div className="glass-bright rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E] animate-pulse" />
              <h2
                className="text-xs font-bold tracking-widest text-[#F43F5E]"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                NO AR AGORA
              </h2>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <p className="text-2xl font-bold text-[#F8F8FC]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {session.currentSinger.name}
                </p>
                <p className="text-[#43CAFE] mt-1 text-sm">{session.currentSinger.song}</p>
              </div>
              <div className="flex items-center gap-0.5">
                {[0.3, 0.6, 1, 0.7, 0.9, 0.5, 0.8, 0.4, 0.7, 0.6].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-[#01ADEF] animate-wave"
                    style={{ height: `${h * 28}px`, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>

            {/* Video link */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Cole o link do YouTube de karaokê..."
                value={videoLink}
                onChange={e => setVideoLink(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-[#001624] text-[#F8F8FC] placeholder-[#9A9AB0] outline-none"
                style={{ border: '1px solid rgba(1,173,239,0.3)', fontFamily: "'Inter', sans-serif" }}
              />
              <a
                href="https://www.youtube.com/results?search_query=karaoke"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 flex items-center gap-1"
                style={{ background: 'rgba(244,63,94,0.15)', color: '#FB7185', border: '1px solid rgba(244,63,94,0.3)', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                ▶ YT
              </a>
              <button
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#001624] transition-all hover:scale-105"
                style={{ background: '#01ADEF', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Carregar
              </button>
            </div>

            {/* Video preview */}
            <div
              className="w-full rounded-xl mb-4 flex items-center justify-center relative overflow-hidden"
              style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg, #0D212E, #143143)' }}
            >
              <div className="text-center z-10">
                <div className="text-5xl mb-2 opacity-40">▶</div>
                <p className="text-[#9A9AB0] text-sm">Preview do vídeo aparece aqui</p>
              </div>
              <div
                className="absolute inset-0"
                style={{ background: 'radial-gradient(ellipse at center, transparent 50%, #001624 100%)' }}
              />
            </div>

            {/* Transport controls */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { icon: '▶', label: 'Play', color: '#01ADEF', action: undefined },
                { icon: '⏸', label: 'Pause', color: '#9A9AB0', action: undefined },
                { icon: '⏭', label: 'Pular', color: '#9A9AB0', action: undefined },
                { icon: '🎤', label: 'Começou!', color: '#43CAFE', action: () => onTelaoAction('singing') },
                { icon: '🗳', label: 'Votar', color: '#F43F5E', action: startVoting },
                { icon: '✕', label: 'Cancelar', color: '#9A9AB0', action: undefined },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.action}
                  className="py-3 rounded-xl font-semibold text-xs transition-all hover:scale-105 active:scale-95 flex flex-col items-center gap-1"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: `${btn.color}15`,
                    color: btn.color,
                    border: `1px solid ${btn.color}40`,
                  }}
                >
                  <span className="text-xl">{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Modo DJ */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎧</span>
                <h2 className="font-bold text-[#F8F8FC]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Modo DJ
                </h2>
                <span className="text-xs text-[#9A9AB0]">música de fundo nos intervalos</span>
              </div>
              <button
                onClick={() => onSetSession({ ...session, djMode: !session.djMode })}
                className="relative w-12 h-6 rounded-full transition-all"
                style={{ background: session.djMode ? '#01ADEF' : '#143143' }}
              >
                <span
                  className="absolute w-5 h-5 rounded-full bg-white top-0.5 transition-all duration-200"
                  style={{ left: session.djMode ? '26px' : '2px' }}
                />
              </button>
            </div>
            {session.djMode && (
              <div className="flex gap-2 animate-fade-in-up">
                <input
                  type="text"
                  placeholder="Link ou nome da música de fundo..."
                  value={djModeLink}
                  onChange={e => setDjModeLink(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-sm bg-[#001624] text-[#F8F8FC] placeholder-[#9A9AB0] outline-none"
                  style={{ border: '1px solid rgba(1,173,239,0.2)' }}
                />
                <a
                  href="https://www.youtube.com/results?search_query=karaoke+background+music"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: 'rgba(244,63,94,0.15)', color: '#FB7185', border: '1px solid rgba(244,63,94,0.3)', fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  YouTube
                </a>
                <a
                  href="https://open.spotify.com/search"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: 'rgba(29,185,84,0.15)', color: '#1DB954', border: '1px solid rgba(29,185,84,0.3)', fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Spotify
                </a>
              </div>
            )}
          </div>

          {/* Voting panel (visible while voting) */}
          {isVoting && (
            <div
              className="rounded-2xl p-5 animate-fade-in-up"
              style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.12), rgba(9,22,30,0.9))', border: '1px solid rgba(244,63,94,0.4)' }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-16 h-16 flex-shrink-0 animate-neon-pulse-magenta rounded-full">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(244,63,94,0.2)" strokeWidth="2.5" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none" stroke="#F43F5E" strokeWidth="2.5"
                      strokeDasharray="100"
                      strokeDashoffset={100 - (voteCountdown / 60) * 100}
                      className="transition-all duration-1000"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span
                    className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[#F43F5E]"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {voteCountdown}
                  </span>
                </div>
                <div>
                  <p className="text-[#F43F5E] font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Votação em andamento!
                  </p>
                  <p className="text-[#9A9AB0] text-sm">{session.currentSinger.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[
                  { label: 'Voz', value: session.voteResults.voz, icon: '🎤', color: '#01ADEF' },
                  { label: 'Performance', value: session.voteResults.performance, icon: '🎭', color: '#43CAFE' },
                  { label: 'Carisma', value: session.voteResults.carisma, icon: '✨', color: '#FBBF24' },
                  { label: 'Diversão', value: session.voteResults.diversao, icon: '🎉', color: '#FB7185' },
                ].map(cat => (
                  <div key={cat.label} className="glass rounded-xl p-2.5 text-center">
                    <p className="text-lg mb-0.5">{cat.icon}</p>
                    <p className="text-[10px] text-[#9A9AB0]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {cat.label}
                    </p>
                    <p
                      className="text-xl font-bold text-[#FBBF24]"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {cat.value.toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="glass rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm text-[#9A9AB0]">Cantaria junto?</span>
                <span className="text-2xl font-bold text-[#43CAFE]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {session.voteResults.cantariaJunto}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: queue + telão controls */}
        <div className="space-y-4">
          {/* Queue */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[#F8F8FC]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Fila{' '}
                <span className="text-[#9A9AB0] font-normal text-xs">{session.queue.length} aguardando</span>
              </h2>
              <button
                onClick={callNext}
                disabled={session.queue.length === 0}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 animate-neon-pulse disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(1,173,239,0.15)',
                  color: '#01ADEF',
                  border: '1px solid rgba(1,173,239,0.5)',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Chamar próximo ▶
              </button>
            </div>
            <div className="space-y-2">
              {session.queue.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl transition-all"
                  style={{ background: 'rgba(20,49,67,0.5)', border: '1px solid rgba(1,173,239,0.1)' }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: i === 0 ? '#01ADEF' : '#143143',
                      color: i === 0 ? '#001624' : '#9A9AB0',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#F8F8FC] truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {item.name}
                    </p>
                    <p className="text-xs text-[#9A9AB0] truncate">{item.song}</p>
                  </div>
                  <button
                    onClick={() => removeFromQueue(item.id)}
                    className="text-[#9A9AB0] hover:text-[#F43F5E] transition-colors text-sm px-1 flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {session.queue.length === 0 && (
                <p className="text-[#9A9AB0] text-sm text-center py-4">Fila vazia</p>
              )}
            </div>
          </div>

          {/* CTA Central */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-bold text-[#F8F8FC]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Central do Telão
              </h2>
              {broadcastFeedback && (
                <span className="text-xs text-[#43CAFE] animate-fade-in-up">
                  📡 {broadcastFeedback}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { msg: 'qr' as CTAMessage, label: 'Escaneie o QR', icon: '📱', color: '#01ADEF' },
                { msg: 'pedido' as CTAMessage, label: 'Peça sua música', icon: '🎵', color: '#1BBFFE' },
                { msg: 'vote' as CTAMessage, label: 'Vote agora!', icon: '🗳', color: '#F43F5E' },
                { msg: 'next' as CTAMessage, label: 'Quem canta a próxima?', icon: '🎤', color: '#FB7185' },
                { msg: 'celebrate' as CTAMessage, label: 'Comemore com a gente!', icon: '🎉', color: '#FBBF24' },
              ].map(cta => (
                <button
                  key={String(cta.msg)}
                  onClick={() => broadcast(cta.msg, cta.label)}
                  className="p-3 rounded-xl text-left transition-all hover:scale-105 active:scale-95 relative overflow-hidden"
                  style={{
                    background: `${cta.color}12`,
                    border: `1px solid ${cta.color}35`,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  <div className="absolute top-1.5 right-1.5 text-[10px] opacity-40">📡</div>
                  <span className="text-xl block mb-1">{cta.icon}</span>
                  <span className="text-xs font-semibold leading-tight" style={{ color: cta.color }}>
                    {cta.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Ranking button — visually separated */}
            <div
              className="h-px w-full mb-3"
              style={{ background: 'linear-gradient(to right, transparent, rgba(245,158,11,0.3), transparent)' }}
            />
            <button
              onClick={() => onTelaoAction('ranking')}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 animate-neon-pulse-gold mb-2"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(251,191,36,0.08))',
                color: '#FBBF24',
                border: '1px solid rgba(245,158,11,0.45)',
              }}
            >
              🏆 Mostrar Ranking no Telão
            </button>
            <button
              onClick={() => setShowPrizeConfirm(true)}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                background: 'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.12))',
                color: '#F59E0B',
                border: '1px solid rgba(251,191,36,0.5)',
              }}
            >
              ⭐ Anunciar Performance da Noite
            </button>
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,22,36,0.92)', backdropFilter: 'blur(10px)' }}
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="glass-bright rounded-2xl p-8 text-center animate-score-reveal"
            onClick={e => e.stopPropagation()}
          >
            <img src={qrUrlLarge} alt="QR Code da sessão" className="w-64 h-64 rounded-xl mb-4 mx-auto" />
            <p
              className="text-[#01ADEF] font-bold text-3xl tracking-[0.3em] mb-1"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {session.code}
            </p>
            <p className="text-[#9A9AB0] text-sm mb-4">justgokaraoke.app/s/{session.code}</p>
            <button
              onClick={() => setShowQRModal(false)}
              className="text-[#9A9AB0] text-sm hover:text-[#F8F8FC] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Prize confirm modal */}
      {showPrizeConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,22,36,0.92)', backdropFilter: 'blur(10px)' }}
        >
          <div
            className="glass-bright rounded-2xl p-8 text-center max-w-sm w-full mx-4 animate-score-reveal"
            style={{ border: '1px solid rgba(251,191,36,0.4)' }}
          >
            <div className="text-5xl mb-4">⭐</div>
            <h2 className="text-xl font-bold text-[#FBBF24] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Anunciar Performance da Noite?
            </h2>
            <p className="text-[#9A9AB0] text-sm mb-6">
              Isso vai revelar o grande vencedor no telão. Tem certeza?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPrizeConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#9A9AB0] transition-all hover:scale-105"
                style={{ background: 'transparent', border: '1px solid rgba(154,154,176,0.3)', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowPrizeConfirm(false); onTelaoAction('prize'); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-[#001624] transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Anunciar!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
