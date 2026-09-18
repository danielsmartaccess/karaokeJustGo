import { useState, useEffect } from 'react';
import { SessionData, TelaoState, CTAMessage } from '../App';

interface Props {
  session: SessionData;
  telaoState: TelaoState;
  ctaMessage: CTAMessage;
}

const CTA_MAP: Record<string, { title: string; subtitle: string; color: string }> = {
  qr: { title: 'Escaneie o QR Code!', subtitle: 'Aponte a câmera e entre na roda', color: '#01ADEF' },
  pedido: { title: 'Peça Sua Música!', subtitle: 'Acesse pelo QR e escolha sua canção', color: '#43CAFE' },
  vote: { title: 'Vote Agora! 🗳', subtitle: 'Avalie a performance ao vivo', color: '#F43F5E' },
  next: { title: 'Quem Canta a Próxima?', subtitle: 'Inscreva-se pelo app!', color: '#FB7185' },
  celebrate: { title: 'Comemore com a Gente!', subtitle: '🎉 Que performance incrível!', color: '#FBBF24' },
};

function Confetti() {
  const colors = ['#F43F5E', '#01ADEF', '#FBBF24', '#43CAFE', '#F59E0B', '#FB7185', '#F8F8FC'];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {Array.from({ length: 70 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-sm"
          style={{
            width: `${4 + (i % 4)}px`,
            height: `${6 + (i % 5)}px`,
            left: `${(i * 1.43) % 100}%`,
            top: '-20px',
            background: colors[i % colors.length],
            animation: `confetti-fall ${2.5 + (i % 3)}s ${(i % 10) * 0.2}s linear infinite`,
            transform: `rotate(${(i * 37) % 360}deg)`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

function SpotlightBeams() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute top-0 left-[20%] w-48 h-full opacity-[0.07] animate-spotlight"
        style={{
          background: 'linear-gradient(to bottom, #01ADEF, transparent)',
          clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)',
        }}
      />
      <div
        className="absolute top-0 right-[15%] w-56 h-full opacity-[0.06] animate-spotlight"
        style={{
          background: 'linear-gradient(to bottom, #F43F5E, transparent)',
          clipPath: 'polygon(25% 0%, 75% 0%, 100% 100%, 0% 100%)',
          animationDelay: '1.5s',
        }}
      />
      <div
        className="absolute top-0 left-[50%] w-40 h-full opacity-[0.05] animate-spotlight"
        style={{
          background: 'linear-gradient(to bottom, #FBBF24, transparent)',
          clipPath: 'polygon(35% 0%, 65% 0%, 80% 100%, 20% 100%)',
          animationDelay: '0.8s',
        }}
      />
    </div>
  );
}

export default function TelaoScreen({ session, telaoState, ctaMessage }: Props) {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (telaoState !== 'voting') { setCountdown(60); return; }
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [telaoState, countdown]);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://justgokaraoke.app/s/${session.code}&color=FFFFFF&bgcolor=001624`;
  const qrSmall = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://justgokaraoke.app/s/${session.code}&color=FFFFFF&bgcolor=001624`;

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        background: '#001624',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <SpotlightBeams />

      {/* ── LOBBY ── */}
      {telaoState === 'lobby' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-[5%]"
          style={{
            background:
              'radial-gradient(ellipse at 35% 45%, rgba(1,173,239,0.14) 0%, transparent 55%), radial-gradient(ellipse at 65% 55%, rgba(244,63,94,0.08) 0%, transparent 55%)',
          }}
        >
          <p className="text-[#9A9AB0] text-[1.4vw] mb-[0.5%] tracking-widest uppercase">
            {session.venue}
          </p>
          <h1
            className="text-[5.5vw] font-bold text-[#F8F8FC] leading-tight mb-[0.5%] text-center"
            style={{ textShadow: '0 0 60px rgba(1,173,239,0.3)' }}
          >
            Just Go Karaokê
          </h1>
          <p
            className="text-[#01ADEF] text-[1.8vw] mb-[4%] tracking-[0.3em]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Sessão · {session.code}
          </p>

          <div className="flex flex-col items-center mb-[3%]">
            <div
              className="p-[1.5%] rounded-2xl mb-[2%] animate-neon-pulse"
              style={{ background: 'rgba(1,173,239,0.08)', border: '3px solid rgba(1,173,239,0.45)' }}
            >
              <img src={qrUrl} alt="QR Code" className="w-[15vw] h-[15vw] rounded-xl" />
            </div>
            <p className="text-[#F8F8FC] text-[2.2vw] font-bold text-center">
              Aponte a câmera e entre na roda!
            </p>
            <p className="text-[#9A9AB0] text-[1.2vw] mt-[0.5%]">
              justgokaraoke.app/s/{session.code}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#01ADEF] animate-pulse" />
            <span className="text-[#9A9AB0] text-[1.2vw]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {session.participants} participantes conectados
            </span>
          </div>
        </div>
      )}

      {/* ── SINGING ── */}
      {telaoState === 'singing' && (
        <div className="absolute inset-0">
          {/* Video placeholder */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0D212E, #001624)' }}
          >
            <div className="text-center opacity-25">
              <div className="text-[8vw] mb-2">▶</div>
              <p className="text-[#9A9AB0] text-[1.5vw]">Vídeo do YouTube carregado aqui</p>
            </div>
          </div>

          {/* Top strip */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center gap-[2%] px-[3%] py-[1.5%]"
            style={{ background: 'linear-gradient(to bottom, rgba(0,22,36,0.88), transparent)' }}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F43F5E] animate-pulse" />
              <span className="text-[#F43F5E] font-bold text-[1.1vw] tracking-widest">AO VIVO</span>
            </div>
            <div className="w-px h-4 bg-[rgba(255,255,255,0.2)]" />
            <span className="text-white font-bold text-[1.8vw]">{session.currentSinger.name}</span>
            <span className="text-[#9A9AB0] text-[1.4vw]">·</span>
            <span className="text-[#43CAFE] text-[1.4vw]">{session.currentSinger.song}</span>
            {/* Soundwave */}
            <div className="flex items-center gap-0.5 ml-2">
              {[0.4, 0.9, 1, 0.6, 0.8, 0.5, 0.7].map((h, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-[#01ADEF] rounded-full animate-wave"
                  style={{ height: `${h * 18}px`, animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          </div>

          {/* QR corner seal */}
          <div className="absolute bottom-[2%] right-[2%] flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
            <img src={qrSmall} alt="QR" className="w-[6vw] h-[6vw] rounded-lg" />
            <p
              className="text-white text-[0.9vw]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {session.code}
            </p>
          </div>
        </div>
      )}

      {/* ── VOTING ── */}
      {telaoState === 'voting' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-[5%]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 25%, rgba(244,63,94,0.22) 0%, transparent 55%), #001624',
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[25%] h-full opacity-20"
            style={{
              background: 'linear-gradient(to bottom, #F43F5E 0%, transparent 70%)',
              clipPath: 'polygon(30% 0%, 70% 0%, 95% 100%, 5% 100%)',
            }}
          />

          <p className="text-[#F43F5E] text-[1.4vw] font-bold tracking-widest uppercase mb-[1%]">
            Hora de votar!
          </p>
          <p className="text-[#F8F8FC] text-[3.5vw] font-bold mb-[4%]">
            {session.currentSinger.name}
          </p>

          {/* Countdown ring */}
          <div className="relative mb-[4%] animate-neon-pulse-magenta rounded-full" style={{ width: '14vw', height: '14vw' }}>
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(244,63,94,0.2)" strokeWidth="5" />
              <circle
                cx="50" cy="50" r="44" fill="none" stroke="#F43F5E" strokeWidth="5"
                strokeDasharray="276.46"
                strokeDashoffset={276.46 - (countdown / 60) * 276.46}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="font-bold text-[#F43F5E] leading-none"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '4.5vw' }}
              >
                {countdown}
              </span>
              <span className="text-[#9A9AB0] text-[1vw]">segundos</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-[2%] w-full max-w-[60%]">
            {[
              { label: 'Voz', icon: '🎤', color: '#01ADEF' },
              { label: 'Performance', icon: '🎭', color: '#43CAFE' },
              { label: 'Carisma', icon: '✨', color: '#FBBF24' },
              { label: 'Diversão', icon: '🎉', color: '#FB7185' },
            ].map(cat => (
              <div
                key={cat.label}
                className="rounded-2xl text-center py-[4%]"
                style={{
                  background: `${cat.color}18`,
                  border: `1px solid ${cat.color}40`,
                }}
              >
                <p className="text-[2.5vw] mb-1">{cat.icon}</p>
                <p className="font-bold text-[1.1vw]" style={{ color: cat.color }}>
                  {cat.label}
                </p>
                <p className="text-[#9A9AB0] text-[0.9vw] mt-0.5">1 – 5</p>
              </div>
            ))}
          </div>

          <div className="absolute bottom-[2%] right-[2%] opacity-45">
            <img src={qrSmall} alt="QR" className="w-[5vw] h-[5vw] rounded-lg" />
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {telaoState === 'result' && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-[5%]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 35%, rgba(251,191,36,0.15) 0%, transparent 55%), #001624',
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[28%] h-full opacity-15"
            style={{
              background: 'linear-gradient(to bottom, #FBBF24 0%, transparent 65%)',
              clipPath: 'polygon(25% 0%, 75% 0%, 90% 100%, 10% 100%)',
            }}
          />

          <p className="text-[#FBBF24] text-[1.3vw] tracking-widest uppercase mb-[1%]">
            Nota da Plateia
          </p>
          <p className="text-[#F8F8FC] text-[3vw] font-bold mb-[4%]">
            {session.currentSinger.name}
          </p>

          <div className="grid grid-cols-4 gap-[2%] w-full max-w-[65%] mb-[3%]">
            {[
              { label: 'Voz', value: session.voteResults.voz, icon: '🎤', color: '#01ADEF' },
              { label: 'Performance', value: session.voteResults.performance, icon: '🎭', color: '#43CAFE' },
              { label: 'Carisma', value: session.voteResults.carisma, icon: '✨', color: '#FBBF24' },
              { label: 'Diversão', value: session.voteResults.diversao, icon: '🎉', color: '#FB7185' },
            ].map((cat, i) => (
              <div
                key={cat.label}
                className="rounded-2xl text-center py-[4%] animate-score-reveal"
                style={{
                  background: `${cat.color}18`,
                  border: `2px solid ${cat.color}55`,
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                <p className="text-[2.5vw] mb-1">{cat.icon}</p>
                <p className="font-bold text-[1vw] mb-1" style={{ color: cat.color }}>
                  {cat.label}
                </p>
                <p
                  className="font-bold text-[#FBBF24] leading-none"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '4.5vw' }}
                >
                  {cat.value.toFixed(1)}
                </p>
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl px-[4%] py-[2%] text-center animate-score-reveal"
            style={{
              background: 'rgba(67,202,254,0.12)',
              border: '2px solid rgba(67,202,254,0.4)',
              animationDelay: '0.65s',
            }}
          >
            <p className="text-[#9A9AB0] text-[1vw] mb-1">Cantaria junto?</p>
            <p
              className="font-bold text-[#43CAFE] leading-none"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '5vw' }}
            >
              {session.voteResults.cantariaJunto}%
            </p>
          </div>
        </div>
      )}

      {/* ── RANKING ── */}
      {telaoState === 'ranking' && (
        <div
          className="absolute inset-0 flex flex-col p-[5%]"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.18) 0%, transparent 45%), #001624',
          }}
        >
          <div className="text-center mb-[3%]">
            <p className="text-[#F59E0B] text-[1.3vw] tracking-widest uppercase">Hall da Fama</p>
            <h2
              className="text-[4.5vw] font-bold text-[#F8F8FC]"
              style={{ textShadow: '0 0 40px rgba(245,158,11,0.3)' }}
            >
              Ranking da Noite
            </h2>
            <p className="text-[#9A9AB0] text-[1.1vw]">
              {session.venue} · Sessão {session.code}
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-[60%] mx-auto w-full gap-[1.5%]">
            {session.ranking.map((item, i) => (
              <div
                key={item.position}
                className="flex items-center gap-[3%] rounded-2xl px-[3%] py-[2%] animate-hall-of-fame"
                style={{
                  background:
                    i === 0
                      ? 'linear-gradient(135deg, rgba(251,191,36,0.22), rgba(245,158,11,0.12))'
                      : 'rgba(20,49,67,0.6)',
                  border: `1px solid ${i === 0 ? 'rgba(251,191,36,0.45)' : 'rgba(1,173,239,0.15)'}`,
                  animationDelay: `${i * 0.12}s`,
                  boxShadow: i === 0 ? '0 0 30px rgba(251,191,36,0.15)' : 'none',
                }}
              >
                <span
                  className="flex-shrink-0 text-center"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '2.5vw', width: '4vw' }}
                >
                  {i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </span>
                <span
                  className="flex-1 font-bold text-[#F8F8FC]"
                  style={{ fontSize: '2vw' }}
                >
                  {item.name}
                </span>
                <span
                  className="font-bold text-[#FBBF24]"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '2.2vw' }}
                >
                  {item.xp.toLocaleString()} XP
                </span>
              </div>
            ))}
          </div>

          <div className="absolute bottom-[2%] right-[2%] flex flex-col items-center gap-1 opacity-50">
            <img src={qrSmall} alt="QR" className="w-[5vw] h-[5vw] rounded-lg" />
            <p
              className="text-white text-[0.9vw]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {session.code}
            </p>
          </div>
        </div>
      )}

      {/* ── PRIZE ── */}
      {telaoState === 'prize' && (
        <>
          <Confetti />
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-[5%] z-20"
            style={{
              background:
                'radial-gradient(ellipse at 50% 40%, rgba(251,191,36,0.28) 0%, transparent 55%), #001624',
            }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[35%] h-full opacity-25"
              style={{
                background: 'linear-gradient(to bottom, #FBBF24 0%, transparent 60%)',
                clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
              }}
            />

            <p className="text-[#F59E0B] text-[1.5vw] tracking-widest uppercase mb-[2%] animate-fade-in-up">
              Performance da Noite
            </p>
            <div className="animate-score-reveal" style={{ fontSize: '8vw', lineHeight: 1, marginBottom: '3%' }}>
              ⭐
            </div>
            <h2
              className="font-bold text-[#FBBF24] mb-[2%] text-center animate-fade-in-up"
              style={{
                fontSize: '6vw',
                textShadow: '0 0 60px rgba(251,191,36,0.7), 0 0 120px rgba(245,158,11,0.4)',
                animationDelay: '0.2s',
              }}
            >
              {session.ranking[0].name}
            </h2>
            <p className="text-[#9A9AB0] text-[1.5vw] animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              {session.ranking[0].xp.toLocaleString()} XP · Campeã da noite
            </p>

            <div className="flex gap-[3%] mt-[4%] animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
              <div
                className="rounded-2xl px-[4%] py-[2%] text-center glass-bright"
              >
                <p className="text-[#9A9AB0] text-[0.9vw] mb-1">Melhor nota</p>
                <p
                  className="font-bold text-[#FBBF24]"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '2.5vw' }}
                >
                  4.9
                </p>
              </div>
              <div className="rounded-2xl px-[4%] py-[2%] text-center glass-bright">
                <p className="text-[#9A9AB0] text-[0.9vw] mb-1">Cantaria junto</p>
                <p
                  className="font-bold text-[#43CAFE]"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '2.5vw' }}
                >
                  87%
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── CTA OVERLAY (over any state) ── */}
      {ctaMessage && CTA_MAP[ctaMessage] && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div
            className="rounded-3xl px-[6%] py-[4%] text-center animate-score-reveal"
            style={{
              background: `radial-gradient(ellipse, ${CTA_MAP[ctaMessage].color}28, transparent)`,
              border: `3px solid ${CTA_MAP[ctaMessage].color}`,
              boxShadow: `0 0 80px ${CTA_MAP[ctaMessage].color}60, 0 0 160px ${CTA_MAP[ctaMessage].color}20`,
              backdropFilter: 'blur(24px)',
            }}
          >
            <p
              className="font-bold leading-tight mb-[1%]"
              style={{
                color: CTA_MAP[ctaMessage].color,
                fontSize: '4.5vw',
                textShadow: `0 0 40px ${CTA_MAP[ctaMessage].color}`,
              }}
            >
              {CTA_MAP[ctaMessage].title}
            </p>
            <p className="text-[#F8F8FC] text-[1.8vw]">{CTA_MAP[ctaMessage].subtitle}</p>
          </div>
        </div>
      )}
    </div>
  );
}
