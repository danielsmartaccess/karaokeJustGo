import { useState } from 'react';
import { SessionData } from '../App';

interface Props {
  session: SessionData;
}

type ParticipantView = 'enter' | 'signup' | 'request' | 'queue' | 'vote' | 'profile';

export default function ParticipantScreen({ session }: Props) {
  const [view, setView] = useState<ParticipantView>('enter');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [songRequest, setSongRequest] = useState('');
  const [ratings, setRatings] = useState({ voz: 0, performance: 0, carisma: 0, diversao: 0 });
  const [cantariaJunto, setCantariaJunto] = useState(false);
  const [voteSubmitted, setVoteSubmitted] = useState(false);

  const allRated = Object.values(ratings).every(v => v > 0);

  const INPUT = {
    width: '100%',
    padding: '14px 18px',
    background: 'rgba(0,22,36,0.85)',
    border: '1px solid rgba(1,173,239,0.3)',
    borderRadius: '16px',
    color: '#F8F8FC',
    fontFamily: "'Inter', sans-serif",
    fontSize: '16px',
    outline: 'none',
  };

  const BTN_PRIMARY = {
    width: '100%',
    padding: '16px',
    background: '#01ADEF',
    color: '#001624',
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700 as const,
    fontSize: '16px',
    borderRadius: '50px',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.15s',
  };

  const BTN_GHOST = {
    ...BTN_PRIMARY,
    background: 'transparent',
    color: '#9A9AB0',
    border: '1px solid rgba(154,154,176,0.3)',
  };

  const CARD = {
    background: 'rgba(13,33,46,0.95)',
    border: '1px solid rgba(1,173,239,0.2)',
    borderRadius: '24px',
    padding: '24px',
  };

  const NAV_TABS = [
    { key: 'request', icon: '🎵', label: 'Pedir' },
    { key: 'queue', icon: '📋', label: 'Fila' },
    { key: 'vote', icon: '🗳', label: 'Votar' },
    { key: 'profile', icon: '👤', label: 'Perfil' },
  ] as const;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(180deg, #001624 0%, #09161E 100%)', fontFamily: "'Inter', sans-serif" }}
    >
      {/* Mobile topbar */}
      <div
        className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
        style={{ background: 'rgba(0,22,36,0.97)', borderBottom: '1px solid rgba(1,173,239,0.15)' }}
      >
        <span className="font-bold text-[#01ADEF] text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Just Go Karaokê
        </span>
        {view !== 'enter' && view !== 'signup' && (
          <div className="flex gap-1">
            {NAV_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className="px-2 py-1.5 rounded-xl text-xs flex flex-col items-center gap-0.5 transition-all"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  background: view === tab.key ? 'rgba(1,173,239,0.15)' : 'transparent',
                  color: view === tab.key ? '#01ADEF' : '#9A9AB0',
                  minWidth: '44px',
                }}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4" style={{ maxWidth: '420px', margin: '0 auto', width: '100%' }}>

        {/* ── ENTER ── */}
        {view === 'enter' && (
          <div style={CARD} className="w-full">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🎤</div>
              <h1 className="text-2xl font-bold text-[#F8F8FC]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Entrar na Sessão
              </h1>
              <p className="text-[#9A9AB0] text-sm mt-1">{session.venue}</p>
            </div>
            <div className="mb-4">
              <input
                style={{ ...INPUT, textAlign: 'center', letterSpacing: '0.35em', fontSize: '22px', fontFamily: "'JetBrains Mono', monospace" }}
                placeholder="CÓDIGO"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </div>
            <button
              style={{ ...BTN_PRIMARY, background: code.length >= 4 ? '#01ADEF' : '#143143', color: code.length >= 4 ? '#001624' : '#9A9AB0' }}
              onClick={() => code.length >= 4 && setView('signup')}
            >
              Entrar
            </button>
            <p className="text-center text-[#9A9AB0] text-xs mt-4">
              ou escaneie o QR Code no telão
            </p>
          </div>
        )}

        {/* ── SIGNUP ── */}
        {view === 'signup' && (
          <div style={CARD} className="w-full">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="text-xl font-bold text-[#F8F8FC]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Bem-vindo!
              </h2>
              <p className="text-[#9A9AB0] text-sm mt-1">{session.venue} · Sessão {session.code || code}</p>
            </div>
            <div className="space-y-3 mb-5">
              <input
                style={INPUT}
                placeholder="Seu nome"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <input
                style={INPUT}
                placeholder="WhatsApp (opcional)"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                type="tel"
              />
            </div>
            <button
              style={{ ...BTN_PRIMARY, background: name.trim() ? '#01ADEF' : '#143143', color: name.trim() ? '#001624' : '#9A9AB0' }}
              onClick={() => name.trim() && setView('request')}
            >
              Vamos nessa!
            </button>
          </div>
        )}

        {/* ── REQUEST ── */}
        {view === 'request' && (
          <div style={CARD} className="w-full">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">🎵</span>
              <div>
                <h2 className="text-xl font-bold text-[#F8F8FC]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Pedir Música
                </h2>
                <p className="text-[#9A9AB0] text-sm">Olá, {name || 'cantor'}!</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-[#9A9AB0] mb-2 block tracking-wider uppercase">
                Qual música você quer cantar?
              </label>
              <textarea
                style={{ ...INPUT, minHeight: '96px', resize: 'none' } as React.CSSProperties}
                placeholder="Ex: Evidências — Chitãozinho & Xororó"
                value={songRequest}
                onChange={e => setSongRequest(e.target.value)}
              />
              <p className="text-xs text-[#9A9AB0] mt-2">
                Qualquer música — não há catálogo, é você quem escolhe!
              </p>
            </div>
            <button
              style={{
                ...BTN_PRIMARY,
                background: songRequest.trim() ? '#01ADEF' : '#143143',
                color: songRequest.trim() ? '#001624' : '#9A9AB0',
              }}
              onClick={() => songRequest.trim() && setView('queue')}
            >
              Entrar na fila
            </button>
          </div>
        )}

        {/* ── QUEUE ── */}
        {view === 'queue' && (
          <div style={CARD} className="w-full">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">📋</span>
              <h2 className="text-xl font-bold text-[#F8F8FC]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Sua Posição
              </h2>
            </div>

            <div
              className="rounded-2xl p-6 text-center mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(1,173,239,0.14), rgba(9,22,30,0.8))', border: '2px solid rgba(1,173,239,0.4)' }}
            >
              <p className="text-[#9A9AB0] text-sm mb-1">você está em</p>
              <p
                className="font-bold text-[#01ADEF] leading-none"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '72px' }}
              >
                3º
              </p>
              <p className="text-[#9A9AB0] text-sm mt-1">na fila</p>
            </div>

            <div
              className="rounded-2xl p-4 mb-4 glass"
              style={{ border: '1px solid rgba(1,173,239,0.15)' }}
            >
              <p className="text-xs text-[#9A9AB0] mb-1">Sua pedida</p>
              <p className="text-[#F8F8FC] font-semibold">{songRequest || "Evidências — Chitãozinho & Xororó"}</p>
            </div>

            <p className="text-center text-[#9A9AB0] text-sm mb-4">
              Acompanhe o andamento no telão!
            </p>
            <button style={BTN_GHOST} onClick={() => { setView('request'); setSongRequest(''); }}>
              Cancelar pedido
            </button>
          </div>
        )}

        {/* ── VOTE ── */}
        {view === 'vote' && (
          <div style={CARD} className="w-full">
            {!voteSubmitted ? (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-3xl">🗳</span>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-[#F8F8FC]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      Votação
                    </h2>
                    <p className="text-[#9A9AB0] text-sm">{session.currentSinger.name}</p>
                  </div>
                  <div
                    className="text-2xl font-bold text-[#F43F5E] animate-neon-pulse-magenta rounded-lg px-2 py-1"
                    style={{ fontFamily: "'JetBrains Mono', monospace", border: '1px solid rgba(244,63,94,0.3)' }}
                  >
                    60s
                  </div>
                </div>

                <div className="space-y-4 mb-5">
                  {[
                    { key: 'voz' as const, label: 'Voz', icon: '🎤', color: '#01ADEF' },
                    { key: 'performance' as const, label: 'Performance', icon: '🎭', color: '#43CAFE' },
                    { key: 'carisma' as const, label: 'Carisma', icon: '✨', color: '#FBBF24' },
                    { key: 'diversao' as const, label: 'Diversão', icon: '🎉', color: '#FB7185' },
                  ].map(cat => (
                    <div key={cat.key}>
                      <div className="flex items-center gap-2 mb-2">
                        <span>{cat.icon}</span>
                        <span className="text-sm font-semibold" style={{ color: cat.color, fontFamily: "'Space Grotesk', sans-serif" }}>
                          {cat.label}
                        </span>
                        <span className="ml-auto text-sm font-bold" style={{ color: ratings[cat.key] ? cat.color : '#9A9AB0', fontFamily: "'JetBrains Mono', monospace" }}>
                          {ratings[cat.key] || '—'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            onClick={() => setRatings(r => ({ ...r, [cat.key]: n }))}
                            className="flex-1 py-3 rounded-xl font-bold text-lg transition-all hover:scale-110 active:scale-95"
                            style={{
                              background: ratings[cat.key] >= n ? `${cat.color}28` : 'rgba(20,49,67,0.5)',
                              border: `2px solid ${ratings[cat.key] >= n ? cat.color : 'rgba(1,173,239,0.15)'}`,
                              color: ratings[cat.key] >= n ? cat.color : '#9A9AB0',
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cantaria junto toggle */}
                <button
                  onClick={() => setCantariaJunto(!cantariaJunto)}
                  className="w-full py-4 rounded-2xl mb-4 flex items-center justify-between px-5 transition-all hover:scale-[1.02]"
                  style={{
                    background: cantariaJunto ? 'rgba(67,202,254,0.12)' : 'rgba(20,49,67,0.5)',
                    border: `2px solid ${cantariaJunto ? 'rgba(67,202,254,0.5)' : 'rgba(1,173,239,0.15)'}`,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  <span className="text-[#F8F8FC] font-semibold">Cantaria junto? 🎶</span>
                  <div
                    className="relative w-12 h-6 rounded-full transition-all"
                    style={{ background: cantariaJunto ? '#43CAFE' : '#143143' }}
                  >
                    <span
                      className="absolute w-5 h-5 bg-white rounded-full top-0.5 transition-all duration-200"
                      style={{ left: cantariaJunto ? '26px' : '2px' }}
                    />
                  </div>
                </button>

                <button
                  style={{
                    ...BTN_PRIMARY,
                    background: allRated ? '#01ADEF' : '#143143',
                    color: allRated ? '#001624' : '#9A9AB0',
                  }}
                  onClick={() => allRated && setVoteSubmitted(true)}
                >
                  {allRated ? 'Enviar voto' : 'Avalie todas as categorias'}
                </button>
              </>
            ) : (
              <div className="text-center py-10">
                <div className="text-6xl mb-4 animate-score-reveal">✅</div>
                <h2 className="text-2xl font-bold text-[#F8F8FC] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Voto enviado!
                </h2>
                <p className="text-[#9A9AB0]">Obrigado pela avaliação</p>
                <button
                  className="mt-6 text-[#01ADEF] text-sm"
                  onClick={() => { setVoteSubmitted(false); setRatings({ voz: 0, performance: 0, carisma: 0, diversao: 0 }); }}
                >
                  Votar novamente
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE ── */}
        {view === 'profile' && (
          <div style={CARD} className="w-full">
            <div className="text-center mb-6">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl font-bold text-[#001624]"
                style={{ background: 'linear-gradient(135deg, #01ADEF, #43CAFE)', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {(name || 'U').charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-[#F8F8FC]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {name || 'Participante'}
              </h2>
              <p className="text-[#9A9AB0] text-sm">{session.venue}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'rgba(1,173,239,0.1)', border: '1px solid rgba(1,173,239,0.25)' }}
              >
                <p className="text-2xl font-bold text-[#01ADEF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  1.240
                </p>
                <p className="text-[#9A9AB0] text-xs mt-1">XP Total</p>
              </div>
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}
              >
                <p className="text-2xl font-bold text-[#FBBF24]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  4º
                </p>
                <p className="text-[#9A9AB0] text-xs mt-1">Posição na sessão</p>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs text-[#9A9AB0] mb-3 uppercase tracking-wider">Badges conquistados</p>
              <div className="flex flex-wrap gap-2">
                {['🎤 Estreante', '🔥 Animado', '🎭 Performático', '⭐ Top 5'].map(badge => (
                  <span
                    key={badge}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{
                      background: 'rgba(1,173,239,0.1)',
                      border: '1px solid rgba(1,173,239,0.3)',
                      color: '#43CAFE',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-[#9A9AB0] mb-3 uppercase tracking-wider">Músicas cantadas hoje</p>
              <div className="space-y-2">
                {["Evidências — Chitãozinho & Xororó", "Asa Branca — Luiz Gonzaga"].map(song => (
                  <div
                    key={song}
                    className="glass rounded-xl p-3 text-sm text-[#F8F8FC]"
                  >
                    {song}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
