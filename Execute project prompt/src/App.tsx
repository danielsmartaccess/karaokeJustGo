import { useState } from 'react';
import HostScreen from './screens/HostScreen';
import TelaoScreen from './screens/TelaoScreen';
import ParticipantScreen from './screens/ParticipantScreen';

export type TelaoState = 'lobby' | 'singing' | 'voting' | 'result' | 'ranking' | 'prize';
export type CTAMessage = 'qr' | 'pedido' | 'vote' | 'next' | 'celebrate' | null;

export interface QueueItem {
  id: string;
  name: string;
  song: string;
}

export interface SessionData {
  code: string;
  venue: string;
  status: 'scheduled' | 'open' | 'live' | 'ended';
  participants: number;
  currentSinger: { name: string; song: string; videoUrl: string };
  queue: QueueItem[];
  voteResults: { voz: number; performance: number; carisma: number; diversao: number; cantariaJunto: number };
  ranking: Array<{ position: number; name: string; xp: number; badge: string }>;
  djMode: boolean;
}

const INITIAL_SESSION: SessionData = {
  code: 'ANITA7',
  venue: 'Armazém Anita',
  status: 'live',
  participants: 34,
  currentSinger: {
    name: 'Lucas Ferreira',
    song: "Evidências — Chitãozinho & Xororó",
    videoUrl: '',
  },
  queue: [
    { id: '1', name: 'Mariana Costa', song: 'Trem Bala — Ana Vilela' },
    { id: '2', name: 'Pedro Santos', song: 'Ai Se Eu Te Pego — Michel Teló' },
    { id: '3', name: 'Juliana Ramos', song: 'Mulher do Fim do Mundo — Elza Soares' },
    { id: '4', name: 'Rafael Lima', song: 'Like a Prayer — Madonna' },
  ],
  voteResults: { voz: 4.2, performance: 4.7, carisma: 4.8, diversao: 4.9, cantariaJunto: 87 },
  ranking: [
    { position: 1, name: 'Mariana Costa', xp: 2840, badge: '🏆' },
    { position: 2, name: 'Lucas Ferreira', xp: 2210, badge: '🥈' },
    { position: 3, name: 'Juliana Ramos', xp: 1980, badge: '🥉' },
    { position: 4, name: 'Pedro Santos', xp: 1650, badge: '⭐' },
    { position: 5, name: 'Fernanda Lopes', xp: 1420, badge: '⭐' },
  ],
  djMode: false,
};

type View = 'host' | 'telao' | 'participant';

const TELAO_STATES: TelaoState[] = ['lobby', 'singing', 'voting', 'result', 'ranking', 'prize'];

export default function App() {
  const [view, setView] = useState<View>('host');
  const [telaoState, setTelaoState] = useState<TelaoState>('lobby');
  const [ctaMessage, setCtaMessage] = useState<CTAMessage>(null);
  const [session, setSession] = useState<SessionData>(INITIAL_SESSION);

  const handleCTA = (msg: CTAMessage) => {
    setCtaMessage(msg);
    setTimeout(() => setCtaMessage(null), 5000);
  };

  return (
    <div className="min-h-full bg-[#001624] text-[#F8F8FC]">
      {/* Demo navigation */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-2 px-4 py-2 flex-wrap"
        style={{ background: 'rgba(0,22,36,0.97)', borderBottom: '1px solid rgba(1,173,239,0.18)', backdropFilter: 'blur(8px)' }}
      >
        {/* Logo */}
        <span
          className="font-bold text-sm text-[#01ADEF] mr-3 tracking-wider"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          JUST GO
        </span>

        {/* View switcher */}
        {([
          { key: 'host', label: '🎛 Host', desc: 'Cabine do DJ' },
          { key: 'telao', label: '📺 Telão', desc: 'Projeção pública' },
          { key: 'participant', label: '📱 Participante', desc: 'PWA mobile' },
        ] as const).map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              background: view === v.key ? '#01ADEF' : 'rgba(1,173,239,0.08)',
              color: view === v.key ? '#001624' : '#9A9AB0',
              border: `1px solid ${view === v.key ? '#01ADEF' : 'rgba(1,173,239,0.2)'}`,
            }}
            title={v.desc}
          >
            {v.label}
          </button>
        ))}

        {/* Telão state picker (only visible on telao view) */}
        {view === 'telao' && (
          <>
            <div className="w-px h-5 bg-[rgba(1,173,239,0.25)] mx-1" />
            <span className="text-[#9A9AB0] text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              estado:
            </span>
            {TELAO_STATES.map(s => (
              <button
                key={s}
                onClick={() => setTelaoState(s)}
                className="px-2 py-1 rounded-lg text-xs transition-all hover:scale-105"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  background: telaoState === s ? 'rgba(244,63,94,0.25)' : 'rgba(244,63,94,0.06)',
                  color: telaoState === s ? '#FB7185' : '#9A9AB0',
                  border: `1px solid ${telaoState === s ? '#F43F5E' : 'rgba(244,63,94,0.18)'}`,
                }}
              >
                {s}
              </button>
            ))}
          </>
        )}
      </nav>

      <div className="pt-10">
        {view === 'host' && (
          <HostScreen
            session={session}
            onSetSession={setSession}
            onTelaoAction={setTelaoState}
            onCTA={handleCTA}
            telaoState={telaoState}
          />
        )}

        {view === 'telao' && (
          <div className="p-4">
            <TelaoScreen session={session} telaoState={telaoState} ctaMessage={ctaMessage} />
          </div>
        )}

        {view === 'participant' && (
          <ParticipantScreen session={session} />
        )}
      </div>
    </div>
  );
}
