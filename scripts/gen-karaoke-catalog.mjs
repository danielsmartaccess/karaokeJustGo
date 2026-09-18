/**
 * Gera src/data/karaokeCatalog.ts — o catálogo de sugestões do participante.
 *
 * Por que um gerador e não uma lista escrita à mão: vídeo de karaokê sai do ar.
 * Canal é removido, faixa recebe bloqueio de direitos autorais, upload vira
 * privado. Uma lista fixa apodrece em silêncio e o participante descobre no
 * meio da noite, com o telão na cara dele.
 *
 * O script busca a versão karaokê de cada música desta curadoria, confere que o
 * vídeo existe (oEmbed) E que toca embutido (playabilityStatus do /embed, que é
 * exatamente o caminho que o telão usa), e só então grava. O que não passar é
 * relatado e fica de fora.
 *
 * Uso:
 *   node scripts/gen-karaoke-catalog.mjs
 *   node scripts/gen-karaoke-catalog.mjs --dry   (não escreve, só relata)
 *
 * Vale reexecutar antes de um evento importante.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'data', 'karaokeCatalog.ts');
const DRY = process.argv.includes('--dry');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * Curadoria: as mais pedidas em karaokê no Brasil, equilibrando o que a casa
 * canta junto (sertanejo, pagode, rock nacional) com os clássicos que todo
 * mundo arrisca (pop e rock internacional).
 */
const CURADORIA = [
  // --- Sertanejo ---
  { title: 'Evidências', artist: 'Chitãozinho & Xororó', category: 'sertanejo' },
  { title: 'Pense em Mim', artist: 'Leandro & Leonardo', category: 'sertanejo' },
  { title: 'Eu Sei de Cor', artist: 'Marília Mendonça', category: 'sertanejo' },
  { title: 'Choram as Rosas', artist: 'Bruno & Marrone', category: 'sertanejo' },
  { title: 'Fio de Cabelo', artist: 'Chitãozinho & Xororó', category: 'sertanejo' },

  // --- Pagode e samba ---
  { title: 'Cheia de Manias', artist: 'Raça Negra', category: 'pagode' },
  { title: 'Deixa Acontecer', artist: 'Grupo Revelação', category: 'pagode' },
  { title: 'Trem das Onze', artist: 'Adoniran Barbosa', category: 'pagode' },
  { title: 'Você Abusou', artist: 'Antônio Carlos e Jocafi', category: 'pagode' },

  // --- MPB ---
  { title: 'Sozinho', artist: 'Caetano Veloso', category: 'mpb' },
  { title: 'Anunciação', artist: 'Alceu Valença', category: 'mpb' },
  { title: 'Trem-Bala', artist: 'Ana Vilela', category: 'mpb' },
  { title: 'Ainda Bem', artist: 'Marisa Monte', category: 'mpb' },
  { title: 'É Isso Aí', artist: 'Ana Carolina e Seu Jorge', category: 'mpb' },

  // --- Rock nacional ---
  { title: 'Tempo Perdido', artist: 'Legião Urbana', category: 'rock-nacional' },
  { title: 'Pais e Filhos', artist: 'Legião Urbana', category: 'rock-nacional' },
  { title: 'Exagerado', artist: 'Cazuza', category: 'rock-nacional' },
  { title: 'Meu Erro', artist: 'Os Paralamas do Sucesso', category: 'rock-nacional' },
  { title: 'Sonífera Ilha', artist: 'Titãs', category: 'rock-nacional' },

  // --- Pop internacional ---
  { title: 'Someone Like You', artist: 'Adele', category: 'pop' },
  { title: 'Rolling in the Deep', artist: 'Adele', category: 'pop' },
  { title: 'Perfect', artist: 'Ed Sheeran', category: 'pop' },
  { title: 'Shallow', artist: 'Lady Gaga e Bradley Cooper', category: 'pop' },
  { title: 'Blinding Lights', artist: 'The Weeknd', category: 'pop' },
  { title: 'Locked Out of Heaven', artist: 'Bruno Mars', category: 'pop' },
  { title: 'I Will Survive', artist: 'Gloria Gaynor', category: 'pop' },

  // --- Rock internacional ---
  { title: "Livin' on a Prayer", artist: 'Bon Jovi', category: 'rock' },
  { title: "Sweet Child O' Mine", artist: "Guns N' Roses", category: 'rock' },
  { title: "Don't Stop Me Now", artist: 'Queen', category: 'rock' },
  { title: 'Bohemian Rhapsody', artist: 'Queen', category: 'rock' },
  { title: 'Total Eclipse of the Heart', artist: 'Bonnie Tyler', category: 'rock' },
  { title: 'Wonderwall', artist: 'Oasis', category: 'rock' },
  { title: 'Africa', artist: 'Toto', category: 'rock' },
  { title: 'Hey Jude', artist: 'The Beatles', category: 'rock' },
];

const semAcento = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Título que promete uma base de karaokê, e não o clipe original. */
function pareceKaraoke(titulo) {
  const t = semAcento(titulo);
  return /karaoke|playback|instrumental|sing along|sing-along/.test(t);
}

/** Exclui versões que atrapalham quem vai cantar. */
function ehRuim(titulo) {
  const t = semAcento(titulo);
  return /com voz|com vocal|with vocal|cover|tutorial|aula |como cantar|reaction/.test(t);
}

async function buscar(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
  });
  if (!res.ok) throw new Error(`busca HTTP ${res.status}`);
  const html = await res.text();

  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!m) throw new Error('ytInitialData nao encontrado');

  const data = JSON.parse(m[1]);
  const encontrados = [];

  // Caminha a árvore procurando videoRenderer, sem depender do formato exato
  // da página, que a YouTube muda com frequência.
  const visitar = (no) => {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) return no.forEach(visitar);
    if (no.videoRenderer) {
      const v = no.videoRenderer;
      const titulo = v.title?.runs?.[0]?.text ?? v.title?.simpleText;
      const duracao = v.lengthText?.simpleText;
      const canal = v.ownerText?.runs?.[0]?.text ?? v.longBylineText?.runs?.[0]?.text;
      if (v.videoId && titulo) {
        encontrados.push({ youtubeId: v.videoId, titulo, duracao, canal });
      }
    }
    Object.values(no).forEach(visitar);
  };
  visitar(data);

  return encontrados;
}

/** Existe e é público? */
async function existe(id) {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
  );
  if (!res.ok) return null;
  return res.json();
}

/**
 * Toca embutido? oEmbed responde 200 até para vídeo que bloqueia incorporação,
 * então a checagem real é pedir a página /embed — o mesmo caminho do telão.
 */
async function tocaEmbutido(id) {
  const res = await fetch(`https://www.youtube.com/embed/${id}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
  });
  if (!res.ok) return false;
  const html = await res.text();
  const status = html.match(/"playabilityStatus":\{"status":"(\w+)"/)?.[1];
  if (status && status !== 'OK') return false;
  return !/"status":"(UNPLAYABLE|ERROR|LOGIN_REQUIRED)"/.test(html);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function resolver(musica) {
  const query = `${musica.title} ${musica.artist} karaokê`;
  const resultados = await buscar(query);

  const candidatos = resultados
    .filter((r) => pareceKaraoke(r.titulo) && !ehRuim(r.titulo))
    // Precisa citar a música, senão vem o karaokê de outra faixa do mesmo
    // artista. O casamento por palavra isolada usa só palavras longas: "Ai Que
    // Saudade Dela" casava com "Ai Que Vontade" quando bastava a primeira.
    .filter((r) => {
      const t = semAcento(r.titulo);
      if (t.includes(semAcento(musica.title))) return true;
      const palavrasLongas = semAcento(musica.title)
        .split(/\s+/)
        .filter((p) => p.length >= 5);
      return palavrasLongas.length > 0 && palavrasLongas.every((p) => t.includes(p));
    })
    .slice(0, 6);

  for (const c of candidatos) {
    const info = await existe(c.youtubeId);
    if (!info) continue;
    if (!(await tocaEmbutido(c.youtubeId))) continue;
    return {
      ...musica,
      youtubeId: c.youtubeId,
      duration: c.duracao ?? '—',
      channel: info.author_name ?? c.canal ?? '',
      videoTitle: info.title ?? c.titulo,
    };
  }
  return null;
}

// --- Execução ---

const ok = [];
const falhas = [];

for (const [i, musica] of CURADORIA.entries()) {
  const rotulo = `${musica.title} — ${musica.artist}`;
  try {
    const achado = await resolver(musica);
    if (achado) {
      ok.push(achado);
      console.log(
        `[${i + 1}/${CURADORIA.length}] ok      ${rotulo}  (${achado.youtubeId}, ${achado.duration}, ${achado.channel})`,
      );
    } else {
      falhas.push({ rotulo, motivo: 'nenhum karaoke valido nos resultados' });
      console.log(`[${i + 1}/${CURADORIA.length}] FALHA   ${rotulo}`);
    }
  } catch (e) {
    falhas.push({ rotulo, motivo: e.message });
    console.log(`[${i + 1}/${CURADORIA.length}] ERRO    ${rotulo} — ${e.message}`);
  }
  await espera(700); // gentileza com o YouTube
}

console.log(`\nresolvidos: ${ok.length}/${CURADORIA.length}`);
if (falhas.length) {
  console.log('nao entraram no catalogo:');
  falhas.forEach((f) => console.log(`  - ${f.rotulo}: ${f.motivo}`));
}

if (DRY) {
  console.log('\n--dry: nada foi escrito.');
  process.exit(0);
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const linhas = ok
  .map(
    (s, i) => `  {
    id: '${i + 1}',
    title: '${esc(s.title)}',
    artist: '${esc(s.artist)}',
    duration: '${esc(s.duration)}',
    thumbnail: 'https://img.youtube.com/vi/${s.youtubeId}/mqdefault.jpg',
    youtubeId: '${s.youtubeId}',
    available: true,
    category: '${s.category}',
    channel: '${esc(s.channel)}',
  },`,
  )
  .join('\n');

const conteudo = `// GERADO POR scripts/gen-karaoke-catalog.mjs — não editar à mão.
// Regerar: node scripts/gen-karaoke-catalog.mjs
// Última geração: ${new Date().toISOString().slice(0, 10)} (${ok.length} músicas verificadas)
//
// Cada vídeo foi conferido no momento da geração: existe, é público e toca
// embutido. Vídeo de karaokê sai do ar — vale regerar antes de um evento.

import type { Song } from '../types';

export type KaraokeCategory =
  | 'sertanejo'
  | 'pagode'
  | 'mpb'
  | 'rock-nacional'
  | 'pop'
  | 'rock';

export interface CatalogSong extends Song {
  category: KaraokeCategory;
  /** Canal que publicou a base — útil para o Host conferir a qualidade. */
  channel: string;
}

export const CATEGORY_LABELS: Record<KaraokeCategory, string> = {
  sertanejo: 'Sertanejo',
  pagode: 'Pagode e samba',
  mpb: 'MPB',
  'rock-nacional': 'Rock nacional',
  pop: 'Pop internacional',
  rock: 'Rock internacional',
};

/** As mais pedidas em karaokê, com a base já verificada. */
export const KARAOKE_CATALOG: CatalogSong[] = [
${linhas}
];
`;

writeFileSync(OUT, conteudo, 'utf8');
console.log(`\ngravado: ${OUT}`);
