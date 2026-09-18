import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS, KARAOKE_CATALOG } from '@/data/karaokeCatalog';
import { DEMO_SONG_TITLES, songByTitle } from '@/data/mockData';

/**
 * Integridade do catálogo gerado por scripts/gen-karaoke-catalog.mjs.
 *
 * Não valida se o vídeo continua no ar — isso exigiria rede e tornaria o teste
 * instável. Valida a forma do que o gerador produziu e, principalmente, que a
 * demonstração não ficou apontando para músicas que saíram numa regeração.
 */

describe('catálogo de karaokê', () => {
  it('tem músicas suficientes para as sugestões parecerem um catálogo', () => {
    expect(KARAOKE_CATALOG.length).toBeGreaterThanOrEqual(20);
  });

  it('todo item tem id de vídeo do YouTube bem formado', () => {
    for (const song of KARAOKE_CATALOG) {
      expect(song.youtubeId, song.title).toMatch(/^[\w-]{11}$/);
    }
  });

  it('não repete vídeo nem id', () => {
    const videos = KARAOKE_CATALOG.map((s) => s.youtubeId);
    const ids = KARAOKE_CATALOG.map((s) => s.id);
    expect(new Set(videos).size).toBe(videos.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a thumbnail aponta para o próprio vídeo', () => {
    for (const song of KARAOKE_CATALOG) {
      expect(song.thumbnail, song.title).toContain(song.youtubeId);
    }
  });

  it('toda categoria usada tem rótulo para exibir no filtro', () => {
    for (const song of KARAOKE_CATALOG) {
      expect(CATEGORY_LABELS[song.category], song.title).toBeTruthy();
    }
  });

  it('cobre todos os gêneros do filtro, senão a aba volta vazia', () => {
    const usadas = new Set(KARAOKE_CATALOG.map((s) => s.category));
    for (const categoria of Object.keys(CATEGORY_LABELS)) {
      expect(usadas.has(categoria as never), `sem música em ${categoria}`).toBe(true);
    }
  });

  it('título e artista estão preenchidos', () => {
    for (const song of KARAOKE_CATALOG) {
      expect(song.title.trim()).not.toBe('');
      expect(song.artist.trim()).not.toBe('');
    }
  });
});

describe('dados do modo demo', () => {
  it('todas as músicas da demonstração existem no catálogo', () => {
    // Se o catálogo for regerado e uma música sair (vídeo removido do
    // YouTube), este teste acusa antes de a demonstração cair no fallback
    // silencioso na frente de uma turma.
    for (const title of DEMO_SONG_TITLES) {
      const found = KARAOKE_CATALOG.find((s) => s.title === title);
      expect(found, `"${title}" saiu do catálogo`).toBeTruthy();
    }
  });

  it('songByTitle devolve a música certa', () => {
    expect(songByTitle('Evidências').title).toBe('Evidências');
  });

  it('songByTitle não quebra a tela quando a música sumiu', () => {
    const fallback = songByTitle('Música Que Não Existe');
    expect(fallback).toBe(KARAOKE_CATALOG[0]);
  });
});
