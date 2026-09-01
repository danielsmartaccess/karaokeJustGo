/**
 * FASE 10: helpers de YouTube/Spotify para o "modo mídia".
 *
 * Não usamos a YouTube Data API (cota diária baixa, exige chave protegida no
 * servidor). O host busca "<nome> karaokê" no YouTube por fora e cola o link — estas
 * funções só extraem o id do vídeo e montam as URLs de embed/watch/busca.
 */

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extrai o id de 11 caracteres de qualquer forma comum de link do YouTube
 * (watch?v=, youtu.be/, /embed/, /shorts/, /live/) ou aceita o id cru colado direto.
 * Retorna `null` se não reconhecer nada utilizável.
 */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (YOUTUBE_ID_RE.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return YOUTUBE_ID_RE.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const v = url.searchParams.get('v');
      if (v && YOUTUBE_ID_RE.test(v)) return v;
      const parts = url.pathname.split('/').filter(Boolean); // ['embed'|'shorts'|'live', ID]
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        return YOUTUBE_ID_RE.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    // não era uma URL — cai no return abaixo
  }
  return null;
}

/** URL de embed (nocookie) já com autoplay; `controls` liga os controles do player. */
export function youtubeEmbedUrl(videoId: string, opts: { autoplay?: boolean } = {}): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    autoplay: opts.autoplay === false ? '0' : '1',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/** Link "assistir no YouTube" — guardado junto pra o host reabrir a fonte se precisar. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Página de resultados do YouTube já com o sufixo "karaokê" — o host abre e escolhe. */
export function youtubeKaraokeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} karaokê`)}`;
}

/** Busca genérica no YouTube (modo DJ — não é karaokê). */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Busca no Spotify (web) — o deep link abre no app se o host tiver instalado. */
export function spotifySearchUrl(query: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}
