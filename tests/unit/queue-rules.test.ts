import { describe, expect, it } from 'vitest';
import { emptyState, reducer } from '@/store/reducer';
import type { KaraokeSnapshot, Song } from '@/types';

/**
 * Regras de negócio da fila (docs/PRODUCT.md, seção "Regras").
 * O reducer é a única porta de entrada para mudanças de estado, então é aqui
 * que as regras são verificadas.
 */

function song(title: string): Song {
  return {
    id: title,
    title,
    artist: 'Artista',
    duration: '3:30',
    thumbnail: '',
    youtubeId: title,
    available: true,
  };
}

function withQueue(names: string[]): KaraokeSnapshot {
  return names.reduce<KaraokeSnapshot>(
    (state, name) =>
      reducer(state, { type: 'ADD_TO_QUEUE', participant: name, song: song(`${name}-song`) }),
    emptyState,
  );
}

describe('fila', () => {
  it('a solicitação do participante nasce pendente e não entra na fila', () => {
    const state = reducer(emptyState, {
      type: 'PROPOSE_SONG',
      participant: 'Ana',
      song: song('Evidências'),
    });

    expect(state.pendingQueue).toHaveLength(1);
    expect(state.pendingQueue[0].status).toBe('pending');
    expect(state.queue).toHaveLength(0);
  });

  it('só entra na fila após o Host aprovar', () => {
    const proposed = reducer(emptyState, {
      type: 'PROPOSE_SONG',
      participant: 'Ana',
      song: song('Evidências'),
    });
    const approved = reducer(proposed, {
      type: 'APPROVE_ENTRY',
      entryId: proposed.pendingQueue[0].id,
    });

    expect(approved.pendingQueue).toHaveLength(0);
    expect(approved.queue).toHaveLength(1);
    expect(approved.queue[0].participant).toBe('Ana');
  });

  it('a recusa do Host remove a solicitação sem registrar no histórico', () => {
    const proposed = reducer(emptyState, {
      type: 'PROPOSE_SONG',
      participant: 'Ana',
      song: song('Evidências'),
    });
    const rejected = reducer(proposed, {
      type: 'REJECT_ENTRY',
      entryId: proposed.pendingQueue[0].id,
    });

    expect(rejected.pendingQueue).toHaveLength(0);
    expect(rejected.history).toHaveLength(0);
  });

  it('marca sempre o primeiro da fila como próximo', () => {
    const state = withQueue(['Ana', 'Carlos', 'Julia']);

    expect(state.queue.map((e) => e.status)).toEqual(['next', 'waiting', 'waiting']);
  });

  it('mantém no máximo uma apresentação em execução', () => {
    const state = withQueue(['Ana', 'Carlos']);
    const first = reducer(state, { type: 'START_PLAYING', entryId: state.queue[0].id });
    const second = reducer(first, { type: 'START_PLAYING', entryId: first.queue[0].id });

    expect(second.currentPlaying?.participant).toBe('Carlos');
    expect(second.queue).toHaveLength(0);
    // A apresentação anterior foi encerrada, não sobreposta.
    expect(second.history.map((e) => e.participant)).toContain('Ana');
  });

  it('apresentação finalizada sai da fila e entra no histórico como concluída', () => {
    const state = withQueue(['Ana']);
    const playing = reducer(state, { type: 'START_PLAYING', entryId: state.queue[0].id });
    const done = reducer(playing, { type: 'FINISH_PLAYING' });

    expect(done.currentPlaying).toBeNull();
    expect(done.history[0].status).toBe('completed');
    expect(done.history[0].finishedAt).toBeTruthy();
  });

  it('apresentação pulada aparece no histórico como cancelada', () => {
    const state = withQueue(['Ana']);
    const playing = reducer(state, { type: 'START_PLAYING', entryId: state.queue[0].id });
    const skipped = reducer(playing, { type: 'SKIP_SONG' });

    expect(skipped.history[0].status).toBe('cancelled');
  });

  it('cancelar uma entrada da fila registra no histórico', () => {
    const state = withQueue(['Ana', 'Carlos']);
    const cancelled = reducer(state, { type: 'CANCEL_ENTRY', entryId: state.queue[0].id });

    expect(cancelled.queue.map((e) => e.participant)).toEqual(['Carlos']);
    expect(cancelled.history[0].participant).toBe('Ana');
    expect(cancelled.history[0].status).toBe('cancelled');
  });

  it('o Host reordena a fila e o status próximo acompanha', () => {
    const state = withQueue(['Ana', 'Carlos', 'Julia']);
    const moved = reducer(state, { type: 'MOVE_UP', entryId: state.queue[1].id });

    expect(moved.queue.map((e) => e.participant)).toEqual(['Carlos', 'Ana', 'Julia']);
    expect(moved.queue[0].status).toBe('next');
    expect(moved.queue[1].status).toBe('waiting');
  });

  it('ignora movimentos fora dos limites da fila', () => {
    const state = withQueue(['Ana', 'Carlos']);
    const up = reducer(state, { type: 'MOVE_UP', entryId: state.queue[0].id });
    const down = reducer(state, { type: 'MOVE_DOWN', entryId: state.queue[1].id });

    expect(up.queue.map((e) => e.participant)).toEqual(['Ana', 'Carlos']);
    expect(down.queue.map((e) => e.participant)).toEqual(['Ana', 'Carlos']);
  });

  it('marca quem ja foi chamado no WhatsApp, para o Host nao repetir', () => {
    const state = withQueue(['Ana', 'Carlos']);
    const marcado = reducer(state, { type: 'MARK_NOTIFIED', entryId: state.queue[0].id });

    expect(marcado.queue[0].notifiedAt).toBeTruthy();
    expect(marcado.queue[1].notifiedAt).toBeUndefined();
  });

  it('marca tambem quem ainda esta aguardando aprovacao', () => {
    const proposto = reducer(emptyState, {
      type: 'PROPOSE_SONG',
      participant: 'Ana',
      song: song('Evidencias'),
    });
    const marcado = reducer(proposto, {
      type: 'MARK_NOTIFIED',
      entryId: proposto.pendingQueue[0].id,
    });

    expect(marcado.pendingQueue[0].notifiedAt).toBeTruthy();
  });
});
