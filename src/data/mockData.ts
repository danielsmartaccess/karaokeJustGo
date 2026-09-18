import type { Advertisement, QueueEntry, Song } from '../types';
import { KARAOKE_CATALOG } from './karaokeCatalog';

/**
 * Dados do MODO DEMO — quando o Supabase não está configurado.
 *
 * As músicas vêm do catálogo verificado (src/data/karaokeCatalog.ts), não de
 * ids escritos à mão: assim a demonstração toca vídeo de karaokê de verdade,
 * igual ao que o participante encontra na busca.
 *
 * Os telefones são fictícios (51 99999-000X) e existem só para exercitar o
 * botão de chamada no WhatsApp. Nunca colocar número real aqui: o repositório
 * é público e o modo demo roda em sala de aula.
 */

/**
 * Busca uma música do catálogo pelo título.
 *
 * Se o catálogo for regerado e a música sair (vídeo removido do YouTube), cai
 * na primeira do catálogo em vez de quebrar a tela no meio da noite. O teste
 * `catalog.test.ts` acusa a divergência antes disso chegar ao bar.
 */
export function songByTitle(title: string): Song {
  return KARAOKE_CATALOG.find((s) => s.title === title) ?? KARAOKE_CATALOG[0];
}

/** Títulos usados pela demonstração — o teste confere que todos existem. */
export const DEMO_SONG_TITLES = [
  'Evidências',
  'Cheia de Manias',
  'Tempo Perdido',
  'Anunciação',
  'Perfect',
  'Someone Like You',
  'Blinding Lights',
  'Bohemian Rhapsody',
] as const;

const now = new Date();
const fmt = (minutesAgo: number) =>
  new Date(now.getTime() - minutesAgo * 60000).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

export const INITIAL_PLAYING: QueueEntry = {
  id: 'q0',
  participant: 'Ana',
  phone: '51999990001',
  song: songByTitle('Evidências'),
  requestedAt: fmt(35),
  startedAt: fmt(5),
  status: 'playing',
};

export const INITIAL_QUEUE: QueueEntry[] = [
  {
    id: 'q1',
    participant: 'Carlos',
    phone: '51999990002',
    song: songByTitle('Cheia de Manias'),
    requestedAt: fmt(30),
    status: 'next',
  },
  {
    id: 'q2',
    participant: 'Julia',
    phone: '51999990003',
    song: songByTitle('Perfect'),
    requestedAt: fmt(25),
    status: 'waiting',
  },
  {
    id: 'q3',
    participant: 'Marcos',
    phone: '51999990004',
    song: songByTitle('Tempo Perdido'),
    requestedAt: fmt(20),
    status: 'waiting',
  },
  {
    id: 'q4',
    participant: 'Fernanda',
    song: songByTitle('Anunciação'),
    requestedAt: fmt(15),
    status: 'waiting',
  },
];

export const INITIAL_HISTORY: QueueEntry[] = [
  {
    id: 'h1',
    participant: 'Rafael',
    song: songByTitle('Bohemian Rhapsody'),
    requestedAt: fmt(80),
    startedAt: fmt(60),
    finishedAt: fmt(56),
    status: 'completed',
  },
  {
    id: 'h2',
    participant: 'Lucas',
    song: songByTitle('Blinding Lights'),
    requestedAt: fmt(55),
    startedAt: fmt(52),
    finishedAt: fmt(50),
    status: 'cancelled',
  },
  {
    id: 'h3',
    participant: 'Camila',
    song: songByTitle('Someone Like You'),
    requestedAt: fmt(110),
    startedAt: fmt(95),
    finishedAt: fmt(91),
    status: 'completed',
  },
];

// --- Biblioteca de conteúdos do telão ---

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
