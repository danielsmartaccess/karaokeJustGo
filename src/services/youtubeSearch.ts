import { KARAOKE_CATALOG } from '../data/karaokeCatalog';

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

/** Recorte da resposta de youtube/v3/search que a aplicacao consome. */
interface YouTubeApiItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

export interface YouTubeResult {
  youtubeId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

/** Normaliza para comparar sem acento — ninguem digita "Evidencias" com acento no celular. */
function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export async function searchKaraoke(
  query: string,
): Promise<{ results: YouTubeResult[]; isMock: boolean }> {
  if (API_KEY) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        query + ' karaokê',
      )}&type=video&maxResults=8&videoCategoryId=10&key=${API_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const items = (data.items ?? []) as YouTubeApiItem[];
        const results: YouTubeResult[] = items.map((item) => ({
          youtubeId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail:
            item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? '',
        }));
        return { results, isMock: false };
      }
    } catch {
      // fall through to mock
    }
  }

  // Sem chave da API, a busca cai no catalogo local verificado. Nao e um
  // placeholder: sao versoes karaoke reais, entao a demonstracao toca de fato.
  const q = semAcento(query);
  const filtered = q
    ? KARAOKE_CATALOG.filter(
        (s) => semAcento(s.title).includes(q) || semAcento(s.artist).includes(q),
      )
    : KARAOKE_CATALOG;

  const results: YouTubeResult[] = filtered.map((s) => ({
    youtubeId: s.youtubeId,
    title: `${s.title} — Karaokê`,
    channelTitle: s.channel || s.artist,
    thumbnail: s.thumbnail,
  }));

  return { results, isMock: true };
}
