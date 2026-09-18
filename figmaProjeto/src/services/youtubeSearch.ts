import { MOCK_SONGS } from '../data/mockData';

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

export interface YouTubeResult {
  youtubeId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

export async function searchKaraoke(
  query: string
): Promise<{ results: YouTubeResult[]; isMock: boolean }> {
  if (API_KEY) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
        query + ' karaokê'
      )}&type=video&maxResults=8&videoCategoryId=10&key=${API_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const results: YouTubeResult[] = (data.items ?? []).map((item: any) => ({
          youtubeId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail:
            item.snippet.thumbnails.medium?.url ??
            item.snippet.thumbnails.default?.url,
        }));
        return { results, isMock: false };
      }
    } catch {
      // fall through to mock
    }
  }

  // Mock fallback — simulates YouTube karaoke results from local catalog
  const q = query.toLowerCase().trim();
  const filtered = q
    ? MOCK_SONGS.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q)
      )
    : MOCK_SONGS;

  const results: YouTubeResult[] = filtered.map((s) => ({
    youtubeId: s.youtubeId,
    title: `${s.title} — Karaokê`,
    channelTitle: s.artist,
    thumbnail: `https://img.youtube.com/vi/${s.youtubeId}/mqdefault.jpg`,
  }));

  return { results, isMock: true };
}
