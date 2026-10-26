import { useEffect, useMemo, useState } from 'react';
import type { KaraokeSnapshot, QueueEntry, Song } from '../types';
import {
  CATEGORY_LABELS,
  KARAOKE_CATALOG,
  type CatalogSong,
  type KaraokeCategory,
} from '../data/karaokeCatalog';
import { useKaraoke } from '../store/KaraokeContext';
import { searchKaraoke, type YouTubeResult } from '../services/youtubeSearch';
import SearchBar from '../components/SearchBar';
import SongCard from '../components/SongCard';
import Modal from '../components/ui/Modal';
import Logo from '../components/Logo';
import ErrorMessage from '../components/ErrorMessage';
import Badge from '../components/ui/Badge';
import {
  loadTicket,
  saveTicket,
  trackTicket,
  type ParticipantTicket,
} from '../lib/participantTicket';
import { Clock, ListMusic, Music2, Play, Loader2, Mic2 } from 'lucide-react';

type Screen = 'home' | 'results' | 'pending' | 'queue' | 'rejected';

/** Tempo que a solicitação pode ficar fora do estado antes de a darmos como recusada. */
const REJECTED_GRACE_MS = 5000;

/** 'todas' = catalogo inteiro; as demais filtram por genero. */
type CategoryFilter = KaraokeCategory | 'todas';

const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  ...(Object.keys(CATEGORY_LABELS) as KaraokeCategory[]).map((id) => ({
    id: id as CategoryFilter,
    label: CATEGORY_LABELS[id],
  })),
];

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 11) return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return digits;
}

function ytResultToSong(r: YouTubeResult): Song {
  return {
    id: r.youtubeId,
    title: r.title,
    artist: r.channelTitle,
    duration: '—',
    thumbnail: r.thumbnail,
    youtubeId: r.youtubeId,
    available: true,
  };
}

function YouTubeResultCard({
  result,
  onPick,
}: {
  result: YouTubeResult;
  onPick: (r: YouTubeResult) => void;
}) {
  return (
    <div className="flex gap-3 items-center bg-slate-900/70 border border-slate-800 hover:border-pink-500/30 rounded-xl p-3 transition-all group">
      <div className="relative shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-slate-800">
        <img
          src={result.thumbnail}
          alt={result.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=112&h=80&fit=crop&auto=format';
          }}
        />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Play className="w-5 h-5 text-white fill-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-100 text-sm font-semibold leading-tight line-clamp-2">
          {result.title}
        </p>
        <p className="text-slate-500 text-xs mt-1 truncate">{result.channelTitle}</p>
      </div>
      <button
        onClick={() => onPick(result)}
        className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all neon-glow-pink"
        style={{ background: '#e91e8c' }}
      >
        Cantar
      </button>
    </div>
  );
}

/** Fila em andamento, vista pelo participante sem sair do modo dele. */
function QueueScreen({
  state,
  ticket,
  onNewSearch,
}: {
  state: KaraokeSnapshot;
  ticket: ParticipantTicket | null;
  onNewSearch: () => void;
}) {
  const { currentPlaying, queue } = state;
  const progress = ticket ? trackTicket(state, ticket) : null;
  const isMine = (entry: QueueEntry) => !!ticket && entry.participant === ticket.participant;

  let headline: string | null = null;
  if (progress?.stage === 'playing') headline = 'É a sua vez! Você está cantando agora 🎤';
  else if (progress?.stage === 'queued' && progress.ahead === 0)
    headline = 'Você é o próximo! Prepare-se 🎤';
  else if (progress?.stage === 'queued')
    headline = `Faltam ${progress.ahead} ${progress.ahead === 1 ? 'música' : 'músicas'} para a sua vez`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-black text-white mb-1.5">Fila ao vivo</h1>
        <p className="text-slate-500 text-sm">Atualiza sozinha — não precisa recarregar a página</p>
      </div>

      {headline && (
        <div className="mb-6 bg-[#e91e8c]/10 border border-[#e91e8c]/30 rounded-xl px-5 py-4 text-sm font-semibold text-pink-300">
          {headline}
        </div>
      )}

      <p className="text-xs font-mono text-slate-600 uppercase tracking-[0.2em] mb-3">
        Cantando agora
      </p>
      {currentPlaying ? (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 mb-6 border ${
            isMine(currentPlaying)
              ? 'bg-[#e91e8c]/10 border-[#e91e8c]/40'
              : 'bg-slate-900/70 border-slate-800'
          }`}
        >
          <Mic2 className="w-5 h-5 text-green-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold truncate">
              {currentPlaying.participant}
              {isMine(currentPlaying) && <span className="text-pink-400"> · você</span>}
            </p>
            <p className="text-slate-500 text-xs truncate">{currentPlaying.song.title}</p>
          </div>
          <Badge status="playing" />
        </div>
      ) : (
        <p className="text-slate-600 text-sm mb-6">Ninguém no palco no momento.</p>
      )}

      <p className="text-xs font-mono text-slate-600 uppercase tracking-[0.2em] mb-3">
        Próximos ({queue.length})
      </p>
      {queue.length === 0 ? (
        <div className="py-10 text-center text-slate-600 font-display">A fila está vazia.</div>
      ) : (
        <ol className="space-y-2">
          {queue.map((entry, index) => (
            <li
              key={entry.id}
              className={`flex items-center gap-3 rounded-xl p-3 border ${
                isMine(entry)
                  ? 'bg-[#e91e8c]/10 border-[#e91e8c]/40'
                  : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              <span className="w-7 text-center text-slate-500 font-mono text-sm shrink-0">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-slate-100 text-sm font-semibold truncate">
                  {entry.participant}
                  {isMine(entry) && <span className="text-pink-400"> · você</span>}
                </p>
                <p className="text-slate-500 text-xs truncate">{entry.song.title}</p>
              </div>
              <Badge status={entry.status} />
            </li>
          ))}
        </ol>
      )}

      <button
        onClick={onNewSearch}
        className="mt-8 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all neon-glow-pink text-white"
        style={{ background: '#e91e8c' }}
      >
        <Music2 className="w-4 h-4" />
        Escolher outra música
      </button>
    </div>
  );
}

export default function ParticipantView() {
  const { state, dispatch, connection } = useKaraoke();
  // Quem recarrega a página volta a acompanhar a própria solicitação.
  const [ticket, setTicket] = useState<ParticipantTicket | null>(loadTicket);
  const [screen, setScreen] = useState<Screen>(() => (ticket ? 'pending' : 'home'));
  const [category, setCategory] = useState<CategoryFilter>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [ytResults, setYtResults] = useState<YouTubeResult[]>([]);
  const [isMockResults, setIsMockResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<YouTubeResult | null>(null);
  const [participantName, setParticipantName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const stage = useMemo(() => (ticket ? trackTicket(state, ticket).stage : null), [state, ticket]);

  // Aprovado pelo Host: troca a tela de espera pela fila em andamento.
  useEffect(() => {
    if ((stage === 'queued' || stage === 'playing') && screen === 'pending') {
      setScreen('queue');
    }
  }, [stage, screen]);

  // Apresentação encerrada: o acompanhamento termina e o participante recomeça.
  useEffect(() => {
    if (stage !== 'done') return;
    setTicket(null);
    saveTicket(null);
    setScreen((current) => (current === 'pending' || current === 'queue' ? 'home' : current));
  }, [stage]);

  // Sumiu de todas as listas com a sala sincronizada: o Host recusou. A espera
  // evita falso positivo enquanto a solicitação ainda está sendo gravada.
  useEffect(() => {
    if (!ticket || stage !== 'unknown') return;
    if (connection === 'connecting' || connection === 'error') return;
    const timer = setTimeout(() => {
      setScreen((current) => (current === 'pending' || current === 'queue' ? 'rejected' : current));
    }, REJECTED_GRACE_MS);
    return () => clearTimeout(timer);
  }, [ticket, stage, connection]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    setIsSearching(true);
    setScreen('results');
    try {
      const { results, isMock } = await searchKaraoke(query);
      setYtResults(results);
      setIsMockResults(isMock);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePickResult = (result: YouTubeResult) => {
    setSelectedResult(result);
    setParticipantName('');
    setPhone('');
    setNameError('');
    setShowModal(true);
  };

  const handlePickCatalogSong = (song: CatalogSong) => {
    handlePickResult({
      youtubeId: song.youtubeId,
      title: `${song.title} — ${song.artist} (Karaokê)`,
      channelTitle: song.channel || song.artist,
      thumbnail: song.thumbnail,
    });
  };

  const handleConfirmPropose = () => {
    if (!participantName.trim()) {
      setNameError('Por favor, digite seu nome ou apelido.');
      return;
    }
    if (!selectedResult) return;

    dispatch({
      type: 'PROPOSE_SONG',
      participant: participantName.trim(),
      phone: phone.replace(/\D/g, '') || undefined,
      song: ytResultToSong(selectedResult),
    });

    const next: ParticipantTicket = {
      participant: participantName.trim(),
      youtubeId: selectedResult.youtubeId,
      title: selectedResult.title,
      artist: selectedResult.channelTitle,
    };
    setTicket(next);
    saveTicket(next);
    setShowModal(false);
    setScreen('pending');
  };

  const handleReset = () => {
    setScreen('home');
    setSearchQuery('');
    setYtResults([]);
    setSelectedResult(null);
    setParticipantName('');
    setPhone('');
  };

  /** Volta à busca; só descarta o acompanhamento quando a solicitação foi recusada. */
  const handleNewSearch = () => {
    if (screen === 'rejected') {
      setTicket(null);
      saveTicket(null);
    }
    handleReset();
  };

  const suggestions =
    category === 'todas'
      ? KARAOKE_CATALOG
      : KARAOKE_CATALOG.filter((song) => song.category === category);

  const queueCount = state.queue.length + (state.currentPlaying ? 1 : 0);

  return (
    <div className="min-h-screen bg-[#06000e] pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#06000e]/92 backdrop-blur-lg border-b border-pink-900/25">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <button
            onClick={() => setScreen('queue')}
            aria-label="Ver fila"
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 text-sm transition-colors"
          >
            <ListMusic className="w-4 h-4" />
            <span className="hidden sm:inline">Ver fila</span>
            {queueCount > 0 && (
              <span className="bg-[#e91e8c] text-white text-xs rounded-full px-1.5 py-0.5 font-mono">
                {queueCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {connection === 'error' && (
          <div className="mb-6">
            <ErrorMessage
              title="Sem conexão com o karaokê"
              message="Sua solicitação pode não chegar ao Host. Tente recarregar a página."
              onRetry={() => window.location.reload()}
            />
          </div>
        )}

        {/* HOME */}
        {screen === 'home' && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-display font-black text-white mb-1.5">
                Escolha sua música
              </h1>
              <p className="text-slate-500 text-sm">
                Busca automática de versões karaokê no YouTube
              </p>
              <div className="mt-4">
                <SearchBar onSearch={handleSearch} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-mono text-slate-600 uppercase tracking-[0.2em]">
                  As mais pedidas no karaokê
                </p>
                <span className="text-[10px] font-mono text-slate-700 shrink-0">
                  {suggestions.length} músicas
                </span>
              </div>

              {/* Filtro por gênero — o catálogo é longo demais para rolar no celular */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                {CATEGORY_FILTERS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setCategory(id)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      category === id
                        ? 'text-white border-transparent'
                        : 'text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700'
                    }`}
                    style={category === id ? { background: '#e91e8c' } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-3 pt-1">
                {suggestions.map((song) => (
                  <SongCard key={song.id} song={song} onSing={() => handlePickCatalogSong(song)} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* RESULTS */}
        {screen === 'results' && (
          <>
            <div className="mb-6">
              <button
                onClick={handleReset}
                className="text-slate-500 hover:text-slate-300 text-sm transition-colors mb-4 flex items-center gap-1"
              >
                ← Voltar
              </button>
              <SearchBar onSearch={handleSearch} />
            </div>

            {isSearching ? (
              <div className="flex flex-col items-center py-16 gap-4">
                <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
                <p className="text-slate-500 text-sm">
                  Buscando versões karaokê de "{searchQuery}"…
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-mono text-slate-600 uppercase tracking-[0.2em]">
                    {ytResults.length > 0
                      ? `${ytResults.length} versões karaokê encontradas`
                      : `Nenhuma versão encontrada para "${searchQuery}"`}
                  </p>
                  {isMockResults && (
                    <span className="text-[10px] font-mono text-slate-700 bg-slate-800 px-2 py-0.5 rounded-full">
                      demo
                    </span>
                  )}
                </div>

                {ytResults.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-5xl mb-4 opacity-20">🎵</div>
                    <p className="text-slate-600 font-display font-semibold">
                      Nenhuma versão karaokê encontrada
                    </p>
                    <p className="text-slate-700 text-sm mt-1">Tente outro termo de busca</p>
                  </div>
                ) : (
                  ytResults.map((result) => (
                    <YouTubeResultCard
                      key={result.youtubeId}
                      result={result}
                      onPick={handlePickResult}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* PENDING — awaiting host approval */}
        {screen === 'pending' && ticket && (
          <div className="flex flex-col items-center text-center py-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{
                background: 'rgba(233,30,140,0.12)',
                border: '2px solid rgba(233,30,140,0.35)',
                boxShadow: '0 0 30px rgba(233,30,140,0.2)',
              }}
            >
              <Clock className="w-10 h-10 text-pink-400" />
            </div>

            <h1 className="text-3xl font-display font-black gradient-title mb-1.5">
              Aguardando aprovação!
            </h1>
            <p className="text-slate-400 mb-8 text-sm">
              O host vai confirmar sua entrada na fila em instantes
            </p>

            <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden mb-6">
              <div className="divide-y divide-slate-800/60">
                <div className="flex justify-between items-center px-5 py-4">
                  <span className="text-slate-500 text-sm">Participante</span>
                  <span className="text-white font-semibold">{ticket.participant}</span>
                </div>
                <div className="flex justify-between items-start px-5 py-4">
                  <span className="text-slate-500 text-sm">Música</span>
                  <div className="text-right max-w-[60%]">
                    <div className="text-white font-semibold text-sm leading-snug">
                      {ticket.title}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">{ticket.artist}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center px-5 py-4">
                  <span className="text-slate-500 text-sm">Status</span>
                  <span className="flex items-center gap-1.5 text-amber-400 text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Pendente
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full bg-[#e91e8c]/10 border border-[#e91e8c]/20 rounded-xl px-5 py-4 mb-8 text-sm text-pink-300">
              🎤 Assim que o host aprovar, esta tela mostra a fila em andamento automaticamente.
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => setScreen('queue')}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-sm transition-all border border-slate-700"
              >
                <ListMusic className="w-4 h-4" />
                Ver fila
              </button>
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all neon-glow-pink text-white"
                style={{ background: '#e91e8c' }}
              >
                <Music2 className="w-4 h-4" />
                Nova busca
              </button>
            </div>
          </div>
        )}

        {/* QUEUE — fila em andamento, no modo do participante */}
        {screen === 'queue' && (
          <QueueScreen state={state} ticket={ticket} onNewSearch={handleNewSearch} />
        )}

        {/* REJECTED — o Host não aprovou */}
        {screen === 'rejected' && (
          <div className="flex flex-col items-center text-center py-8">
            <div className="text-5xl mb-4 opacity-40">🙁</div>
            <h1 className="text-2xl font-display font-black text-white mb-1.5">
              Sua solicitação não foi aprovada
            </h1>
            <p className="text-slate-500 text-sm mb-8">
              Sem problema — escolha outra música e tente de novo.
            </p>
            <button
              onClick={handleNewSearch}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all neon-glow-pink text-white"
              style={{ background: '#e91e8c' }}
            >
              <Music2 className="w-4 h-4" />
              Escolher outra música
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Quem vai cantar?">
        {selectedResult && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center bg-slate-800 border border-slate-700 rounded-xl p-3">
              <img
                src={selectedResult.thumbnail}
                alt={selectedResult.title}
                className="w-16 h-12 object-cover rounded-lg shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=112&h=80&fit=crop&auto=format';
                }}
              />
              <div className="min-w-0">
                <div className="text-white font-semibold text-sm line-clamp-2 leading-snug">
                  {selectedResult.title}
                </div>
                <div className="text-slate-400 text-xs mt-0.5">{selectedResult.channelTitle}</div>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-2">Nome ou apelido *</label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => {
                  setParticipantName(e.target.value);
                  setNameError('');
                }}
                placeholder="Ex.: Ana, DJ Carlos, Marquinho..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmPropose()}
                className={`w-full px-4 py-3 bg-slate-800 border rounded-xl text-slate-200 placeholder-slate-600 outline-none transition-all focus:ring-2 focus:ring-pink-500/30 ${
                  nameError ? 'border-red-500' : 'border-slate-700 focus:border-pink-500'
                }`}
              />
              {nameError && <p className="text-red-400 text-xs mt-1.5">{nameError}</p>}
            </div>

            <div>
              <label className="block text-slate-400 text-sm mb-2">
                Celular WhatsApp
                <span className="text-slate-600 ml-1.5 text-xs">(opcional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="51 99999-0000"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 focus:border-green-500 focus:ring-2 focus:ring-green-500/25 rounded-xl text-slate-200 placeholder-slate-600 outline-none transition-all"
              />
            </div>

            <button
              onClick={handleConfirmPropose}
              className="w-full py-3.5 text-white font-black rounded-xl transition-all neon-glow-pink text-base"
              style={{ background: '#e91e8c' }}
            >
              🎤 Enviar para aprovação
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
