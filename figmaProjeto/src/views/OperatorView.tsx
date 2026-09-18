import React, { useState } from 'react';
import { useKaraoke } from '../store/KaraokeContext';
import Badge from '../components/ui/Badge';
import HistoryTable from '../components/HistoryTable';
import EmptyState from '../components/EmptyState';
import {
  Mic2,
  Play,
  SkipForward,
  Square,
  StopCircle,
  ChevronUp,
  ChevronDown,
  X,
  LogOut,
  Activity,
  Clock,
} from 'lucide-react';

type Tab = 'agora' | 'fila' | 'historico';

export default function OperatorView() {
  const { state, dispatch } = useKaraoke();
  const [loggedIn, setLoggedIn] = useState(false);
  const [operatorName, setOperatorName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<Tab>('agora');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'karaoke' || password === 'admin') {
      setLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Senha incorreta. Dica: "karaoke"');
    }
  };

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-[#07070f] flex items-center justify-center p-4 pb-24">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-5 neon-glow-purple">
              <Mic2 className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-display font-black text-white">
              Bar <span className="text-purple-400">&</span> Música
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">Acesso do Operador</p>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Nome do operador</label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="Seu nome"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25 rounded-xl text-slate-200 placeholder-slate-600 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError('');
                }}
                placeholder="••••••"
                className={`w-full px-4 py-3 bg-slate-800 border rounded-xl text-slate-200 placeholder-slate-600 outline-none transition-all focus:ring-2 focus:ring-purple-500/25 ${
                  loginError ? 'border-red-500' : 'border-slate-700 focus:border-purple-500'
                }`}
              />
              {loginError && <p className="text-red-400 text-xs mt-1.5">{loginError}</p>}
            </div>
            <button
              type="submit"
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold rounded-xl transition-all neon-glow-purple"
            >
              Entrar
            </button>
          </form>
          <p className="text-center text-slate-700 text-xs mt-5">
            Acesso restrito — somente equipe autorizada
          </p>
        </div>
      </div>
    );
  }

  const { currentPlaying, queue, history } = state;

  return (
    <div className="min-h-screen bg-[#07070f] flex flex-col pb-20">
      {/* Header */}
      <header className="bg-slate-950 border-b border-purple-900/25 px-5 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center neon-glow-purple shrink-0">
            <Mic2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="leading-none">
            <span className="font-display font-bold text-white">Bar</span>
            <span className="font-display font-bold text-purple-400"> & Música</span>
            <span className="ml-2 text-slate-600 text-xs hidden sm:inline">Controle do Karaokê</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
            <Activity className="w-3 h-3 text-green-400" />
            <span className="text-green-400">Sistema ativo</span>
          </div>
          <span className="text-slate-500 text-sm hidden sm:inline">
            {operatorName || 'Operador'}
          </span>
          <button
            onClick={() => setLoggedIn(false)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-red-400 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-slate-950 border-b border-slate-800/60 px-5 shrink-0">
        <div className="flex">
          {(
            [
              { id: 'agora', label: 'Agora', badge: currentPlaying ? 1 : 0 },
              { id: 'fila', label: 'Fila', badge: queue.length },
              { id: 'historico', label: 'Histórico', badge: history.length },
            ] as { id: Tab; label: string; badge: number }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${
                tab === t.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                    tab === t.id
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 md:p-6 max-w-5xl mx-auto w-full">
        {/* Agora */}
        {tab === 'agora' && (
          <div className="space-y-5">
            {currentPlaying ? (
              <div className="bg-slate-900 border border-green-500/25 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between bg-green-500/8 px-6 py-3 border-b border-green-500/15">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 font-mono text-sm tracking-widest">EM EXECUÇÃO</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    Início: {currentPlaying.startedAt}
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="flex flex-col justify-between">
                    <div>
                      <p className="text-slate-600 text-xs font-mono uppercase tracking-wider mb-1">
                        Participante
                      </p>
                      <h2 className="text-3xl font-display font-black text-white mb-4">
                        {currentPlaying.participant}
                      </h2>
                      <p className="text-slate-600 text-xs font-mono uppercase tracking-wider mb-1">
                        Música
                      </p>
                      <h3 className="text-lg font-display font-semibold text-purple-300 leading-tight">
                        {currentPlaying.song.title}
                      </h3>
                      <p className="text-slate-400 text-sm">{currentPlaying.song.artist}</p>
                    </div>

                    <div className="flex flex-wrap gap-2.5 mt-6">
                      <button
                        onClick={() => dispatch({ type: 'FINISH_PLAYING' })}
                        className="flex items-center gap-2 px-4 py-2.5 bg-green-600/15 hover:bg-green-600/30 text-green-400 border border-green-500/35 rounded-xl text-sm font-semibold transition-all"
                      >
                        <Square className="w-4 h-4" />
                        Finalizar
                      </button>
                      <button
                        onClick={() => dispatch({ type: 'SKIP_SONG' })}
                        className="flex items-center gap-2 px-4 py-2.5 bg-yellow-600/15 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/35 rounded-xl text-sm font-semibold transition-all"
                      >
                        <SkipForward className="w-4 h-4" />
                        Pular
                      </button>
                      <button
                        onClick={() => dispatch({ type: 'SKIP_SONG' })}
                        className="flex items-center gap-2 px-4 py-2.5 bg-red-600/15 hover:bg-red-600/30 text-red-400 border border-red-500/35 rounded-xl text-sm font-semibold transition-all"
                      >
                        <StopCircle className="w-4 h-4" />
                        Interromper
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-xl overflow-hidden aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${currentPlaying.song.youtubeId}?rel=0&modestbranding=1&iv_load_policy=3`}
                      title={currentPlaying.song.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl">
                <EmptyState
                  icon="🎤"
                  title="Nenhuma apresentação em andamento"
                  description="Inicie uma apresentação da fila para começar o karaokê."
                  action={
                    <button
                      onClick={() => setTab('fila')}
                      className="mt-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-sm transition-all neon-glow-purple"
                    >
                      Gerenciar fila
                    </button>
                  }
                />
              </div>
            )}

            {/* Next up */}
            {queue.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                <div className="shrink-0">
                  <p className="text-slate-600 text-xs font-mono uppercase tracking-wider mb-1">
                    A seguir
                  </p>
                  <span className="text-cyan-400 font-display font-black text-2xl">#1</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-white font-semibold">{queue[0].participant}</span>
                  <span className="text-slate-600 mx-2">—</span>
                  <span className="text-slate-400 text-sm">{queue[0].song.title}</span>
                  <div className="text-slate-600 text-xs mt-0.5">{queue[0].song.artist}</div>
                </div>
                <button
                  onClick={() => dispatch({ type: 'START_PLAYING', entryId: queue[0].id })}
                  disabled={!!currentPlaying}
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-purple-600/15 hover:bg-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-purple-400 border border-purple-500/35 rounded-xl text-sm font-semibold transition-all"
                >
                  <Play className="w-4 h-4" />
                  Iniciar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Fila */}
        {tab === 'fila' && (
          <>
            {queue.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl">
                <EmptyState
                  icon="📋"
                  title="Fila vazia"
                  description="Nenhum participante aguardando. As solicitações dos clientes aparecerão aqui."
                />
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/50">
                        <th className="text-left py-3 px-5 text-slate-500 font-medium w-10">#</th>
                        <th className="text-left py-3 px-5 text-slate-500 font-medium">Participante</th>
                        <th className="text-left py-3 px-5 text-slate-500 font-medium">Música</th>
                        <th className="text-left py-3 px-5 text-slate-500 font-medium hidden md:table-cell">
                          Solicitação
                        </th>
                        <th className="text-left py-3 px-5 text-slate-500 font-medium">Status</th>
                        <th className="text-left py-3 px-5 text-slate-500 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {queue.map((entry, index) => (
                        <tr
                          key={entry.id}
                          className={`hover:bg-slate-800/25 transition-colors ${
                            index === 0 ? 'border-l-2 border-l-cyan-500' : 'border-l-2 border-l-transparent'
                          }`}
                        >
                          <td className="py-3.5 px-5">
                            <span
                              className={`font-display font-black text-lg ${
                                index === 0 ? 'text-cyan-400' : 'text-slate-700'
                              }`}
                            >
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-slate-100 font-semibold">
                            {entry.participant}
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="text-slate-200">{entry.song.title}</div>
                            <div className="text-slate-500 text-xs mt-0.5">{entry.song.artist}</div>
                          </td>
                          <td className="py-3.5 px-5 text-slate-500 font-mono text-xs hidden md:table-cell">
                            {entry.requestedAt}
                          </td>
                          <td className="py-3.5 px-5">
                            <Badge status={entry.status} />
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  dispatch({ type: 'START_PLAYING', entryId: entry.id })
                                }
                                disabled={!!currentPlaying}
                                title="Iniciar apresentação"
                                className="p-1.5 text-green-400 hover:bg-green-500/15 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => dispatch({ type: 'MOVE_UP', entryId: entry.id })}
                                disabled={index === 0}
                                title="Mover para cima"
                                className="p-1.5 text-slate-400 hover:bg-slate-700 rounded-lg disabled:opacity-25 transition-colors"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => dispatch({ type: 'MOVE_DOWN', entryId: entry.id })}
                                disabled={index === queue.length - 1}
                                title="Mover para baixo"
                                className="p-1.5 text-slate-400 hover:bg-slate-700 rounded-lg disabled:opacity-25 transition-colors"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  dispatch({ type: 'CANCEL_ENTRY', entryId: entry.id })
                                }
                                title="Cancelar"
                                className="p-1.5 text-red-400 hover:bg-red-500/15 rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Histórico */}
        {tab === 'historico' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <HistoryTable entries={history} />
          </div>
        )}
      </div>
    </div>
  );
}
