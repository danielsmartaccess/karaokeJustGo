import type { Song, QueueEntry, Advertisement } from '../types';

export const MOCK_SONGS: Song[] = [
  {
    id: '1',
    title: 'Locked Out of Heaven',
    artist: 'Bruno Mars',
    duration: '3:52',
    thumbnail: 'https://img.youtube.com/vi/B_wubTHN42k/hqdefault.jpg',
    youtubeId: 'B_wubTHN42k',
    available: true,
  },
  {
    id: '2',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    duration: '3:20',
    thumbnail: 'https://img.youtube.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
    youtubeId: '4NRXx6U8ABQ',
    available: true,
  },
  {
    id: '3',
    title: 'Houdini',
    artist: 'Dua Lipa',
    duration: '3:07',
    thumbnail: 'https://img.youtube.com/vi/zzSvhgCuDKY/hqdefault.jpg',
    youtubeId: 'zzSvhgCuDKY',
    available: true,
  },
  {
    id: '4',
    title: "Don't Stop Me Now",
    artist: 'Queen',
    duration: '3:29',
    thumbnail: 'https://img.youtube.com/vi/HgzGwKwLmgM/hqdefault.jpg',
    youtubeId: 'HgzGwKwLmgM',
    available: true,
  },
  {
    id: '5',
    title: 'Believer',
    artist: 'Imagine Dragons',
    duration: '3:24',
    thumbnail: 'https://img.youtube.com/vi/7wtfhZwyrcc/hqdefault.jpg',
    youtubeId: '7wtfhZwyrcc',
    available: true,
  },
  {
    id: '6',
    title: "Livin' on a Prayer",
    artist: 'Bon Jovi',
    duration: '4:09',
    thumbnail: 'https://img.youtube.com/vi/lDK9QqIzhwk/hqdefault.jpg',
    youtubeId: 'lDK9QqIzhwk',
    available: true,
  },
  {
    id: '7',
    title: 'Someone Like You',
    artist: 'Adele',
    duration: '4:45',
    thumbnail: 'https://img.youtube.com/vi/hLQl3WQQoQ0/hqdefault.jpg',
    youtubeId: 'hLQl3WQQoQ0',
    available: true,
  },
  {
    id: '8',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    duration: '4:23',
    thumbnail: 'https://img.youtube.com/vi/2Vv-BfVoq4g/hqdefault.jpg',
    youtubeId: '2Vv-BfVoq4g',
    available: true,
  },
  {
    id: '9',
    title: "Sweet Child O' Mine",
    artist: "Guns N' Roses",
    duration: '5:03',
    thumbnail: 'https://img.youtube.com/vi/1w7OgIMMRc4/hqdefault.jpg',
    youtubeId: '1w7OgIMMRc4',
    available: true,
  },
  {
    id: '10',
    title: 'Evidências',
    artist: 'Chitãozinho & Xororó',
    duration: '4:12',
    thumbnail: 'https://img.youtube.com/vi/b4ZGzaohFog/hqdefault.jpg',
    youtubeId: 'b4ZGzaohFog',
    available: true,
  },
  {
    id: '11',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    duration: '4:54',
    thumbnail: 'https://img.youtube.com/vi/Zi_XLOBDo_Y/hqdefault.jpg',
    youtubeId: 'Zi_XLOBDo_Y',
    available: true,
  },
  {
    id: '12',
    title: 'Cheia de Manias',
    artist: 'Raça Negra',
    duration: '4:35',
    thumbnail: 'https://img.youtube.com/vi/KgqLUauGWXo/hqdefault.jpg',
    youtubeId: 'KgqLUauGWXo',
    available: false,
  },
];

const now = new Date();
const fmt = (minutesAgo: number) =>
  new Date(now.getTime() - minutesAgo * 60000).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

export const INITIAL_PLAYING: QueueEntry = {
  id: 'q0',
  participant: 'Ana',
  phone: '51981418383',
  song: MOCK_SONGS[9],
  requestedAt: fmt(35),
  startedAt: fmt(5),
  status: 'playing',
};

export const INITIAL_QUEUE: QueueEntry[] = [
  {
    id: 'q1',
    participant: 'Carlos',
    phone: '51982345678',
    song: MOCK_SONGS[5],
    requestedAt: fmt(30),
    status: 'next',
  },
  {
    id: 'q2',
    participant: 'Julia',
    phone: '51991234567',
    song: MOCK_SONGS[7],
    requestedAt: fmt(25),
    status: 'waiting',
  },
  {
    id: 'q3',
    participant: 'Marcos',
    phone: '51998765432',
    song: MOCK_SONGS[8],
    requestedAt: fmt(20),
    status: 'waiting',
  },
  {
    id: 'q4',
    participant: 'Fernanda',
    song: MOCK_SONGS[6],
    requestedAt: fmt(15),
    status: 'waiting',
  },
];

export const INITIAL_HISTORY: QueueEntry[] = [
  {
    id: 'h1',
    participant: 'Rafael',
    song: MOCK_SONGS[3],
    requestedAt: fmt(80),
    startedAt: fmt(60),
    finishedAt: fmt(56),
    status: 'completed',
  },
  {
    id: 'h2',
    participant: 'Lucas',
    song: MOCK_SONGS[1],
    requestedAt: fmt(55),
    startedAt: fmt(52),
    finishedAt: fmt(50),
    status: 'cancelled',
  },
  {
    id: 'h3',
    participant: 'Camila',
    song: MOCK_SONGS[2],
    requestedAt: fmt(110),
    startedAt: fmt(95),
    finishedAt: fmt(91),
    status: 'completed',
  },
];

// --- Telão content library ---

export interface PresetCTA {
  id: string;
  emoji: string;
  message: string;
}

export interface PresetNotice {
  id: string;
  message: string;
}

export const PRESET_CTAS: PresetCTA[] = [
  { id: 'c1', emoji: '🎤', message: 'QUEM VAI SER O PRÓXIMO?' },
  { id: 'c2', emoji: '👏', message: 'APLAUSOS PARA O CANTOR!' },
  { id: 'c3', emoji: '🎶', message: 'ESCOLHA SUA MÚSICA E ENTRE NA FILA!' },
  { id: 'c4', emoji: '📱', message: 'SIGA O BAR NAS REDES SOCIAIS!' },
  { id: 'c5', emoji: '🍻', message: 'HORA DO HAPPY HOUR!' },
  { id: 'c6', emoji: '🎂', message: 'HOJE TEM ANIVERSARIANTE!' },
  { id: 'c7', emoji: '📸', message: 'POSTE SUA FOTO E MARQUE O BAR!' },
  { id: 'c8', emoji: '🔥', message: 'BORA LOTAR ESSA FILA!' },
];

export const PRESET_NOTICES: PresetNotice[] = [
  { id: 'n1', message: 'INTERVALO DE 10 MINUTOS' },
  { id: 'n2', message: 'O KARAOKÊ RETORNA ÀS 23H' },
  { id: 'n3', message: 'ÚLTIMA MÚSICA DA NOITE' },
  { id: 'n4', message: 'FILA ENCERRADA' },
  { id: 'n5', message: 'ATENÇÃO: PRÓXIMO CANTOR NO PALCO' },
];

export const MOCK_ADS: Advertisement[] = [
  {
    id: 'a1',
    title: 'Happy Hour Bar & Música',
    imageUrl:
      'https://images.unsplash.com/photo-1575444758702-4a6b9222336e?w=800&h=450&fit=crop&auto=format',
    duration: 30,
    createdAt: fmt(60),
  },
  {
    id: 'a2',
    title: 'Caipirinha Especial — R$12',
    imageUrl:
      'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&h=450&fit=crop&auto=format',
    duration: 15,
    createdAt: fmt(90),
  },
];

export const DURATION_OPTIONS: { value: number | null; label: string }[] = [
  { value: 10, label: '10 segundos' },
  { value: 15, label: '15 segundos' },
  { value: 30, label: '30 segundos' },
  { value: 60, label: '1 minuto' },
  { value: 120, label: '2 minutos' },
  { value: null, label: 'Até remover manualmente' },
];
