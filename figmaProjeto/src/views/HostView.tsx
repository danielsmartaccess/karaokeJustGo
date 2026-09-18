import React, { useState } from 'react';
import { useKaraoke } from '../store/KaraokeContext';
import { ScreenContent, Advertisement } from '../types';
import { PRESET_CTAS, PRESET_NOTICES, DURATION_OPTIONS } from '../data/mockData';
import Badge from '../components/ui/Badge';
import HistoryTable from '../components/HistoryTable';
import EmptyState from '../components/EmptyState';
import Logo from '../components/Logo';
import { QRCodeSVG } from 'qrcode.react';
import {
  Mic2, Play, SkipForward, Square, StopCircle, ChevronUp, ChevronDown, X,
  Activity, Tv2, Clock, CheckCircle,
  Trash2, Plus, Eye, QrCode, ThumbsUp, ThumbsDown,
} from 'lucide-react';

type HostTab = 'karaoke' | 'telao' | 'comunicacao' | 'publicidade';
type KaraokeSubTab = 'agora' | 'fila' | 'historico';

const CONTENT_TYPE_META = {
  karaoke: { emoji: '🎤', label: 'KARAOKÊ', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/30' },
  cta: { emoji: '📢', label: 'CHAMADA PARA AÇÃO', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
  notice: { emoji: '📣', label: 'AVISO', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  ad: { emoji: '🖼️', label: 'PUBLICIDADE', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
  qrcode: { emoji: '📱', label: 'QR CODE', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
};

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `0:${sec.toString().padStart(2, '0')}`;
}

// --- Telão Preview ---
function TelaoPreview({ content }: { content: ScreenContent | null }) {
  const type = content?.type ?? 'karaoke';
  const meta = CONTENT_TYPE_META[type];

  return (
    <div className="relative w-full aspect-video bg-[#07070f] border border-slate-700 rounded-xl overflow-hidden">
      {/* Scanline overlay for TV feel */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />

      {(!content || type === 'karaoke') && (
        <div className="absolute inset-0 flex flex-col p-3">
          <div className="text-[9px] font-mono text-purple-400 mb-2 tracking-widest">▶ AGORA CANTANDO</div>
          <div className="text-base font-display font-black text-white leading-none mb-1" style={{ fontSize: 'clamp(10px, 3vw, 18px)' }}>
            Ana
          </div>
          <div className="text-purple-300 mb-1" style={{ fontSize: 'clamp(8px, 2vw, 12px)' }}>Evidências</div>
          <div className="flex-1 bg-slate-900 rounded-lg flex items-center justify-center">
            <Tv2 className="w-5 h-5 text-slate-700" />
          </div>
        </div>
      )}

      {type === 'cta' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-[#07070f]">
          <div style={{ fontSize: 'clamp(16px, 5vw, 32px)' }}>{content?.content?.split(' ')[0]}</div>
          <div className="text-white font-display font-black text-center leading-tight mt-1"
            style={{ fontSize: 'clamp(7px, 2vw, 13px)' }}>
            {content?.title}
          </div>
        </div>
      )}

      {type === 'notice' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07070f] border-2 border-amber-500/40">
          <div className="text-amber-400 font-display font-black text-center"
            style={{ fontSize: 'clamp(7px, 2vw, 13px)' }}>
            📣 {content?.title}
          </div>
        </div>
      )}

      {type === 'ad' && content?.imageUrl && (
        <img
          src={content.imageUrl}
          alt={content.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {type === 'qrcode' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#06000e] gap-2 p-3">
          <div className="bg-white p-2 rounded-lg">
            <QRCodeSVG value={window.location.href} size={60} fgColor="#06000e" bgColor="#ffffff" />
          </div>
          <p className="text-green-400 text-[9px] font-mono text-center">Escaneie para participar</p>
        </div>
      )}

      {/* Type badge */}
      <div className={`absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${meta.bg} ${meta.color}`}>
        {meta.emoji} {meta.label}
      </div>
    </div>
  );
}

// --- Current Telão Status ---
function TelaoStatusCard() {
  const { state, dispatch } = useKaraoke();
  const { currentContent = null, timeRemaining = null, isOnline = true } = state.telao ?? {};
  const type = currentContent?.type ?? 'karaoke';
  const meta = CONTENT_TYPE_META[type];

  return (
    <div className={`rounded-xl border p-4 ${meta.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Agora no Telão</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full animate-pulse ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className={`text-xs font-mono ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
            TELÃO {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="text-2xl">{meta.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-mono font-bold tracking-widest ${meta.color}`}>{meta.label}</div>
          <div className="text-white font-semibold text-sm mt-0.5 leading-snug">
            {currentContent?.title ?? 'Apresentação de Karaokê'}
          </div>
          {timeRemaining !== null && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-400 font-mono text-sm">{fmtTime(timeRemaining)} restantes</span>
            </div>
          )}
        </div>
        {currentContent && (
          <button
            onClick={() => dispatch({ type: 'CLEAR_TELAO_CONTENT' })}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 rounded-lg text-xs font-semibold transition-all"
          >
            <X className="w-3.5 h-3.5" />
            Encerrar
          </button>
        )}
      </div>
    </div>
  );
}

// --- Send to telão helper ---
function useSendToTelao() {
  const { dispatch } = useKaraoke();
  const [sentId, setSentId] = useState<string | null>(null);

  const send = (content: ScreenContent) => {
    dispatch({ type: 'SET_TELAO_CONTENT', content });
    setSentId(content.id);
    setTimeout(() => setSentId(null), 3000);
  };

  return { send, sentId };
}

// --- Comunicação Tab ---
function ComunicacaoTab() {
  const { send, sentId } = useSendToTelao();
  const [customCta, setCustomCta] = useState('');
  const [ctaDuration, setCtaDuration] = useState<number | null>(30);
  const [customNotice, setCustomNotice] = useState('');
  const [noticeDuration, setNoticeDuration] = useState<number | null>(30);
  const [activeSection, setActiveSection] = useState<'cta' | 'notice'>('cta');

  const sendCTA = (emoji: string, message: string, duration: number | null) => {
    send({
      id: `cta-${Date.now()}`,
      type: 'cta',
      title: message,
      content: `${emoji} ${message}`,
      duration,
      priority: 3,
    });
  };

  const sendNotice = (message: string, duration: number | null) => {
    send({
      id: `notice-${Date.now()}`,
      type: 'notice',
      title: message,
      duration,
      priority: 2,
    });
  };

  return (
    <div className="space-y-5">
      {/* Section toggle */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
        <button
          onClick={() => setActiveSection('cta')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeSection === 'cta' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          📢 Chamadas para Ação
        </button>
        <button
          onClick={() => setActiveSection('notice')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeSection === 'notice' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          📣 Avisos
        </button>
      </div>

      {activeSection === 'cta' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRESET_CTAS.map((cta) => {
              const isActive = sentId === `cta-${cta.id}`;
              return (
                <div
                  key={cta.id}
                  className="flex items-center gap-3 bg-slate-900 border border-slate-800 hover:border-cyan-500/30 rounded-xl p-3.5 group transition-all"
                >
                  <span className="text-2xl shrink-0">{cta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-semibold leading-snug">{cta.message}</p>
                  </div>
                  <button
                    onClick={() => sendCTA(cta.emoji, cta.message, 30)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                        : 'bg-cyan-600/15 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/35'
                    }`}
                  >
                    {isActive ? <><CheckCircle className="w-3.5 h-3.5" /> Enviado</> : <><Tv2 className="w-3.5 h-3.5" /> Exibir</>}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Custom CTA */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              Nova Chamada Personalizada
            </h3>
            <textarea
              value={customCta}
              onChange={(e) => setCustomCta(e.target.value)}
              placeholder="Digite a mensagem que será exibida no telão..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/25 rounded-xl text-slate-200 placeholder-slate-600 outline-none transition-all resize-none text-sm"
            />
            <div className="flex gap-3">
              <select
                value={ctaDuration ?? ''}
                onChange={(e) => setCtaDuration(e.target.value === '' ? null : Number(e.target.value))}
                className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 focus:border-cyan-500 rounded-xl text-slate-300 outline-none text-sm"
              >
                {DURATION_OPTIONS.map((o) => (
                  <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
                ))}
              </select>
              <button
                disabled={!customCta.trim()}
                onClick={() => { sendCTA('📢', customCta.trim(), ctaDuration); setCustomCta(''); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600/20 hover:bg-cyan-600/35 disabled:opacity-40 disabled:cursor-not-allowed text-cyan-400 border border-cyan-500/40 rounded-xl text-sm font-bold transition-all"
              >
                <Tv2 className="w-4 h-4" />
                Exibir no Telão
              </button>
            </div>
          </div>
        </>
      )}

      {activeSection === 'notice' && (
        <>
          <div className="space-y-2.5">
            {PRESET_NOTICES.map((notice) => {
              const isActive = sentId === `notice-${notice.id}`;
              return (
                <div
                  key={notice.id}
                  className="flex items-center gap-3 bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-xl px-4 py-3.5 transition-all"
                >
                  <span className="text-xl shrink-0">📣</span>
                  <p className="flex-1 text-slate-200 text-sm font-semibold">{notice.message}</p>
                  <button
                    onClick={() => sendNotice(notice.message, 30)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                        : 'bg-amber-600/15 hover:bg-amber-600/30 text-amber-400 border border-amber-500/35'
                    }`}
                  >
                    {isActive ? <><CheckCircle className="w-3.5 h-3.5" /> Enviado</> : <><Tv2 className="w-3.5 h-3.5" /> Exibir</>}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              Novo Aviso Personalizado
            </h3>
            <textarea
              value={customNotice}
              onChange={(e) => setCustomNotice(e.target.value)}
              placeholder="Digite o aviso que será exibido no telão..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 rounded-xl text-slate-200 placeholder-slate-600 outline-none transition-all resize-none text-sm"
            />
            <div className="flex gap-3">
              <select
                value={noticeDuration ?? ''}
                onChange={(e) => setNoticeDuration(e.target.value === '' ? null : Number(e.target.value))}
                className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl text-slate-300 outline-none text-sm"
              >
                {DURATION_OPTIONS.map((o) => (
                  <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
                ))}
              </select>
              <button
                disabled={!customNotice.trim()}
                onClick={() => { sendNotice(customNotice.trim(), noticeDuration); setCustomNotice(''); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600/20 hover:bg-amber-600/35 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 border border-amber-500/40 rounded-xl text-sm font-bold transition-all"
              >
                <Tv2 className="w-4 h-4" />
                Exibir no Telão
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Publicidade Tab ---
function PublicidadeTab() {
  const { state, dispatch } = useKaraoke();
  const { send, sentId } = useSendToTelao();
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [duration, setDuration] = useState<number | null>(30);
  const [showPreview, setShowPreview] = useState(false);

  const handlePublish = () => {
    if (!title.trim() || !imageUrl.trim()) return;
    const ad: Advertisement = {
      id: `ad-${Date.now()}`,
      title: title.trim(),
      imageUrl: imageUrl.trim(),
      duration,
      createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    dispatch({ type: 'ADD_AD', ad });
    send({
      id: ad.id,
      type: 'ad',
      title: ad.title,
      imageUrl: ad.imageUrl,
      duration: ad.duration,
      priority: 4,
    });
    setTitle('');
    setImageUrl('');
    setShowPreview(false);
  };

  const sendAd = (ad: Advertisement) => {
    send({
      id: `send-${ad.id}`,
      type: 'ad',
      title: ad.title,
      imageUrl: ad.imageUrl,
      duration: ad.duration,
      priority: 4,
    });
  };

  return (
    <div className="space-y-5">
      {/* Ad library */}
      {state.telao.ads.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">Biblioteca de Publicidades</h3>
          <div className="space-y-3">
            {state.telao.ads.map((ad) => {
              const isActive = sentId === `send-${ad.id}`;
              return (
                <div
                  key={ad.id}
                  className="flex gap-3 items-center bg-slate-900 border border-slate-800 hover:border-pink-500/25 rounded-xl p-3 transition-all"
                >
                  <div className="w-20 h-12 shrink-0 rounded-lg overflow-hidden bg-slate-800">
                    <img
                      src={ad.imageUrl}
                      alt={ad.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 font-semibold text-sm truncate">{ad.title}</div>
                    <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {ad.duration ? `${ad.duration}s` : 'Manual'}
                      <span className="text-slate-700">•</span>
                      {ad.createdAt}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => sendAd(ad)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                          : 'bg-pink-600/15 hover:bg-pink-600/30 text-pink-400 border border-pink-500/35'
                      }`}
                    >
                      {isActive ? <><CheckCircle className="w-3.5 h-3.5" />Enviado</> : <><Tv2 className="w-3.5 h-3.5" />Exibir</>}
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'REMOVE_AD', id: ad.id })}
                      className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New ad form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Plus className="w-4 h-4 text-pink-400" />
          Nova Publicidade
        </h3>

        <div>
          <label className="block text-slate-500 text-xs mb-1.5">Título da publicidade</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Happy Hour Bar & Música"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/25 rounded-xl text-slate-200 placeholder-slate-600 outline-none transition-all text-sm"
          />
        </div>

        <div>
          <label className="block text-slate-500 text-xs mb-1.5">URL da imagem</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => { setImageUrl(e.target.value); setShowPreview(false); }}
              placeholder="Cole aqui o link da imagem que será exibida no telão"
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/25 rounded-xl text-slate-200 placeholder-slate-600 outline-none transition-all text-sm"
            />
            <button
              onClick={() => setShowPreview(true)}
              disabled={!imageUrl.trim()}
              className="shrink-0 flex items-center gap-1.5 px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-400 border border-slate-700 rounded-xl text-sm transition-all"
            >
              <Eye className="w-4 h-4" />
              Prévia
            </button>
          </div>
        </div>

        {/* Image preview */}
        {showPreview && imageUrl && (
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800 aspect-video">
            <img
              src={imageUrl}
              alt="Prévia da publicidade"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        <div className="flex gap-3">
          <select
            value={duration ?? ''}
            onChange={(e) => setDuration(e.target.value === '' ? null : Number(e.target.value))}
            className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 focus:border-pink-500 rounded-xl text-slate-300 outline-none text-sm"
          >
            {DURATION_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setTitle(''); setImageUrl(''); setShowPreview(false); }}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-xl text-sm font-semibold transition-all"
          >
            Cancelar
          </button>
          <button
            disabled={!title.trim() || !imageUrl.trim()}
            onClick={handlePublish}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-pink-600/20 hover:bg-pink-600/35 disabled:opacity-40 disabled:cursor-not-allowed text-pink-400 border border-pink-500/40 rounded-xl text-sm font-bold transition-all"
          >
            <Tv2 className="w-4 h-4" />
            Publicar no Telão
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Telão Tab ---
function TelaoTab() {
  const { state, dispatch } = useKaraoke();
  const { currentContent = null, isOnline = true } = state.telao ?? {};

  return (
    <div className="space-y-5">
      {/* Online toggle */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
        <div className="flex items-center gap-3">
          <Tv2 className={`w-5 h-5 ${isOnline ? 'text-green-400' : 'text-red-400'}`} />
          <div>
            <p className="text-white font-semibold text-sm">Status do Telão</p>
            <p className={`text-xs font-mono mt-0.5 ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
              {isOnline ? 'ONLINE — Transmitindo' : 'OFFLINE — Desconectado'}
            </p>
          </div>
        </div>
        <button
          onClick={() => dispatch({ type: 'SET_TELAO_ONLINE', online: !isOnline })}
          className={`relative w-12 h-6 rounded-full transition-all duration-300 ${isOnline ? 'bg-green-500' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${isOnline ? 'left-6.5' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Current status */}
      <TelaoStatusCard />

      {/* Preview */}
      <div>
        <h3 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-3">Preview do Telão</h3>
        <TelaoPreview content={currentContent} />
      </div>

      {/* Return to karaoke */}
      {currentContent && (
        <button
          onClick={() => dispatch({ type: 'CLEAR_TELAO_CONTENT' })}
          className="w-full flex items-center justify-center gap-3 py-4 bg-purple-600/15 hover:bg-purple-600/30 text-purple-400 border border-purple-500/40 rounded-xl font-bold text-base transition-all neon-glow-purple"
        >
          <Mic2 className="w-5 h-5" />
          🎤 Retornar ao Karaokê
        </button>
      )}

      {!currentContent && (
        <div className="bg-green-500/8 border border-green-500/20 rounded-xl px-5 py-4 text-center">
          <p className="text-green-400 text-sm font-semibold">✓ Telão exibindo Karaokê</p>
          <p className="text-slate-500 text-xs mt-1">Nenhum conteúdo temporário ativo</p>
        </div>
      )}

      {/* QR Code button */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <QrCode className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-300">QR Code de Entrada</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Exibe um QR code no telão para que os participantes escaneiem e entrem na fila.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl shrink-0">
            <QRCodeSVG value={window.location.href} size={72} fgColor="#06000e" bgColor="#ffffff" level="H" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-slate-500 text-xs font-mono break-all">{window.location.href}</p>
            <button
              onClick={() => {
                const url = window.location.href;
                dispatch({
                  type: 'SET_TELAO_CONTENT',
                  content: { id: `qr-${Date.now()}`, type: 'qrcode', title: 'QR Code de Entrada', duration: null, priority: 1 },
                });
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600/15 hover:bg-green-600/30 text-green-400 border border-green-500/35 rounded-xl text-sm font-bold transition-all"
            >
              <Tv2 className="w-4 h-4" />
              Exibir QR Code no Telão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Karaokê Tab (queue + controls) ---
function KaraokeTab() {
  const { state, dispatch } = useKaraoke();
  const [sub, setSub] = useState<KaraokeSubTab>('agora');
  const { currentPlaying, queue, pendingQueue = [], history } = state;

  return (
    <div>
      <div className="flex gap-0 mb-5 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {([
          { id: 'agora', label: 'Agora', badge: currentPlaying ? 1 : 0 },
          { id: 'fila', label: 'Fila', badge: queue.length + pendingQueue.length },
          { id: 'historico', label: 'Histórico', badge: history.length },
        ] as { id: KaraokeSubTab; label: string; badge: number }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              sub === t.id ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${sub === t.id ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-800 text-slate-600'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {sub === 'agora' && (
        <div className="space-y-4">
          {currentPlaying ? (
            <div className="bg-slate-900 border border-green-500/25 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between bg-green-500/8 px-5 py-3 border-b border-green-500/15">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 font-mono text-xs tracking-widest">EM EXECUÇÃO</span>
                </div>
                <span className="text-slate-500 text-xs font-mono">Início: {currentPlaying.startedAt}</span>
              </div>
              <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <p className="text-slate-600 text-xs font-mono uppercase tracking-wider mb-0.5">Participante</p>
                  <h2 className="text-2xl font-display font-black text-white mb-3">{currentPlaying.participant}</h2>
                  <p className="text-slate-600 text-xs font-mono uppercase tracking-wider mb-0.5">Música</p>
                  <h3 className="text-base font-display font-semibold text-purple-300">{currentPlaying.song.title}</h3>
                  <p className="text-slate-400 text-sm">{currentPlaying.song.artist}</p>
                  <div className="flex flex-wrap gap-2.5 mt-5">
                    <button onClick={() => dispatch({ type: 'FINISH_PLAYING' })} className="flex items-center gap-2 px-4 py-2.5 bg-green-600/15 hover:bg-green-600/30 text-green-400 border border-green-500/35 rounded-xl text-sm font-semibold transition-all">
                      <Square className="w-4 h-4" /> Finalizar
                    </button>
                    <button onClick={() => dispatch({ type: 'SKIP_SONG' })} className="flex items-center gap-2 px-4 py-2.5 bg-yellow-600/15 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/35 rounded-xl text-sm font-semibold transition-all">
                      <SkipForward className="w-4 h-4" /> Pular
                    </button>
                    <button onClick={() => dispatch({ type: 'SKIP_SONG' })} className="flex items-center gap-2 px-4 py-2.5 bg-red-600/15 hover:bg-red-600/30 text-red-400 border border-red-500/35 rounded-xl text-sm font-semibold transition-all">
                      <StopCircle className="w-4 h-4" /> Interromper
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
                description="Inicie uma apresentação da fila para começar."
                action={
                  <button onClick={() => setSub('fila')} className="mt-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold text-sm transition-all neon-glow-purple">
                    Gerenciar fila
                  </button>
                }
              />
            </div>
          )}

          {queue.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
              <div className="shrink-0">
                <p className="text-slate-600 text-xs font-mono uppercase tracking-wider mb-0.5">A seguir</p>
                <span className="text-cyan-400 font-display font-black text-2xl">#1</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-white font-semibold">{queue[0].participant}</span>
                <span className="text-slate-600 mx-2">—</span>
                <span className="text-slate-400 text-sm">{queue[0].song.title}</span>
              </div>
              <button
                onClick={() => dispatch({ type: 'START_PLAYING', entryId: queue[0].id })}
                disabled={!!currentPlaying}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-purple-600/15 hover:bg-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-purple-400 border border-purple-500/35 rounded-xl text-sm font-semibold transition-all"
              >
                <Play className="w-4 h-4" /> Iniciar
              </button>
            </div>
          )}
        </div>
      )}

      {sub === 'fila' && (
        <>
          {/* Pending approvals */}
          {pendingQueue.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-xs font-mono text-amber-400 uppercase tracking-widest">
                  Aguardando aprovação — {pendingQueue.length}
                </h3>
              </div>
              <div className="space-y-2">
                {pendingQueue.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/25 rounded-xl px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-semibold text-sm">{entry.participant}</span>
                      <span className="text-slate-500 text-xs mx-2">—</span>
                      <span className="text-slate-400 text-xs line-clamp-1">{entry.song.title}</span>
                      <p className="text-slate-600 text-xs mt-0.5">{entry.song.artist} · {entry.requestedAt}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => dispatch({ type: 'APPROVE_ENTRY', entryId: entry.id })}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600/15 hover:bg-green-600/30 text-green-400 border border-green-500/35 rounded-xl text-xs font-bold transition-all"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => dispatch({ type: 'REJECT_ENTRY', entryId: entry.id })}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/25 rounded-xl text-xs font-bold transition-all"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {queue.length === 0 && pendingQueue.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl">
              <EmptyState icon="📋" title="Fila vazia" description="Nenhum participante aguardando." />
            </div>
          ) : queue.length === 0 ? null : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50">
                      <th className="text-left py-3 px-4 text-slate-500 font-medium w-10">#</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-medium">Participante</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-medium">Música</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-medium hidden md:table-cell">Solicitação</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-slate-500 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {queue.map((entry, index) => (
                      <tr key={entry.id} className={`hover:bg-slate-800/25 transition-colors ${index === 0 ? 'border-l-2 border-l-cyan-500' : 'border-l-2 border-l-transparent'}`}>
                        <td className="py-3 px-4">
                          <span className={`font-display font-black text-lg ${index === 0 ? 'text-cyan-400' : 'text-slate-700'}`}>{index + 1}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-100 font-semibold">{entry.participant}</td>
                        <td className="py-3 px-4">
                          <div className="text-slate-200">{entry.song.title}</div>
                          <div className="text-slate-500 text-xs mt-0.5">{entry.song.artist}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-xs hidden md:table-cell">{entry.requestedAt}</td>
                        <td className="py-3 px-4"><Badge status={entry.status} /></td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => dispatch({ type: 'START_PLAYING', entryId: entry.id })} disabled={!!currentPlaying} title="Iniciar" className="p-1.5 text-green-400 hover:bg-green-500/15 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <Play className="w-4 h-4" />
                            </button>
                            <button onClick={() => dispatch({ type: 'MOVE_UP', entryId: entry.id })} disabled={index === 0} title="Mover para cima" className="p-1.5 text-slate-400 hover:bg-slate-700 rounded-lg disabled:opacity-25 transition-colors">
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => dispatch({ type: 'MOVE_DOWN', entryId: entry.id })} disabled={index === queue.length - 1} title="Mover para baixo" className="p-1.5 text-slate-400 hover:bg-slate-700 rounded-lg disabled:opacity-25 transition-colors">
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button onClick={() => dispatch({ type: 'CANCEL_ENTRY', entryId: entry.id })} title="Cancelar" className="p-1.5 text-red-400 hover:bg-red-500/15 rounded-lg transition-colors">
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

      {sub === 'historico' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <HistoryTable entries={history} />
        </div>
      )}
    </div>
  );
}

// --- Main HostView ---
export default function HostView() {
  const hostName = 'Dani';
  const [tab, setTab] = useState<HostTab>('karaoke');

  const TABS = [
    { id: 'karaoke' as HostTab, emoji: '🎤', label: 'Karaokê' },
    { id: 'telao' as HostTab, emoji: '📺', label: 'Telão' },
    { id: 'comunicacao' as HostTab, emoji: '📣', label: 'Comunicação' },
    { id: 'publicidade' as HostTab, emoji: '🖼️', label: 'Publicidade' },
  ];

  return (
    <div className="min-h-screen bg-[#07070f] flex flex-col pb-20">
      {/* Header */}
      <header className="bg-slate-950 border-b border-purple-900/25 px-5 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="text-slate-700 text-xs ml-1 hidden sm:inline">Host Control</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
            <Activity className="w-3 h-3 text-green-400" />
            <span className="text-green-400">Sistema ativo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-600/30 border border-purple-500/40 rounded-full flex items-center justify-center">
              <span className="text-purple-300 text-xs font-bold">{hostName[0]?.toUpperCase()}</span>
            </div>
            <span className="text-slate-400 text-sm hidden sm:inline">{hostName}</span>
          </div>
        </div>
      </header>

      {/* Main tabs */}
      <div className="bg-slate-950 border-b border-slate-800/60 px-5 shrink-0 overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 md:p-6 max-w-5xl mx-auto w-full">
        {tab === 'karaoke' && <KaraokeTab />}
        {tab === 'telao' && <TelaoTab />}
        {tab === 'comunicacao' && <ComunicacaoTab />}
        {tab === 'publicidade' && <PublicidadeTab />}
      </div>
    </div>
  );
}
