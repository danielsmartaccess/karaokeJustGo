import { useLayoutEffect, useRef, useState } from 'react';
import { useKaraoke, type ConnectionStatus } from '../../store/KaraokeContext';
import { TELAO_CANVAS, mirrorScale } from '../../lib/telao';
import { TelaoScreen } from './TelaoScreen';

/**
 * Espelho do telão no painel do Host.
 *
 * Renderiza a MESMA tela da TV (TelaoScreen) numa área de 1920x1080 e a reduz
 * por transform até caber na largura disponível. Não é uma miniatura redesenhada:
 * é a tela real, então qualquer mudança no telão aparece aqui sozinha.
 */
export function TelaoMirror() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setScale(mirrorScale(el.clientWidth));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      data-testid="telao-mirror"
      className="relative w-full aspect-video overflow-hidden rounded-xl border border-slate-700 bg-black"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute left-0 top-0 origin-top-left"
        style={{
          width: TELAO_CANVAS.width,
          height: TELAO_CANVAS.height,
          transform: `scale(${scale})`,
        }}
      >
        <TelaoScreen variant="mirror" />
      </div>
    </div>
  );
}

const SYNC_LABEL: Record<Exclude<ConnectionStatus, 'live'>, { text: string; cls: string }> = {
  demo: { text: 'Modo demo: não está ligado a outros aparelhos', cls: 'text-cyan-400' },
  connecting: { text: 'Conectando…', cls: 'text-amber-400' },
  error: { text: 'Sem conexão: o telão pode estar desatualizado', cls: 'text-red-400' },
};

/** Quando este painel leu o estado da sala pela última vez. */
export function MirrorSyncStatus() {
  const { connection, lastSyncAt } = useKaraoke();

  if (connection === 'live') {
    return (
      <span className="text-xs font-mono text-green-400">
        {lastSyncAt
          ? `Sincronizado às ${new Date(lastSyncAt).toLocaleTimeString('pt-BR')}`
          : 'Sincronizando…'}
      </span>
    );
  }

  const { text, cls } = SYNC_LABEL[connection];
  return <span className={`text-xs font-mono ${cls}`}>{text}</span>;
}
