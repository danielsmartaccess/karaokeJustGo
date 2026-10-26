import { describe, expect, it } from 'vitest';
import { emptyState, reducer } from '@/store/reducer';
import { trackTicket, type ParticipantTicket } from '@/lib/participantTicket';
import type { KaraokeSnapshot, Song } from '@/types';

/**
 * Acompanhamento da solicitação pelo próprio participante: da espera pela
 * aprovação até a fila em andamento.
 */

function song(id: string): Song {
  return {
    id,
    title: `Música ${id}`,
    artist: 'Artista',
    duration: '3:30',
    thumbnail: '',
    youtubeId: id,
    available: true,
  };
}

const ticket: ParticipantTicket = {
  participant: 'Ana',
  youtubeId: 'a1',
  title: 'Música a1',
  artist: 'Artista',
};

function propose(state: KaraokeSnapshot, participant: string, id: string): KaraokeSnapshot {
  return reducer(state, { type: 'PROPOSE_SONG', participant, song: song(id) });
}

describe('acompanhamento da solicitação do participante', () => {
  it('sem nada na sala, o estado é desconhecido', () => {
    expect(trackTicket(emptyState, ticket).stage).toBe('unknown');
  });

  it('aguarda aprovação enquanto está pendente', () => {
    const state = propose(emptyState, 'Ana', 'a1');
    expect(trackTicket(state, ticket).stage).toBe('pending');
  });

  it('ao ser aprovado, passa para a fila e informa quantos cantam antes', () => {
    let state = propose(emptyState, 'Bia', 'b1');
    state = reducer(state, { type: 'APPROVE_ENTRY', entryId: state.pendingQueue[0].id });
    state = propose(state, 'Ana', 'a1');
    state = reducer(state, { type: 'APPROVE_ENTRY', entryId: state.pendingQueue[0].id });

    const progress = trackTicket(state, ticket);
    expect(progress.stage).toBe('queued');
    if (progress.stage === 'queued') expect(progress.ahead).toBe(1);
  });

  it('o primeiro da fila tem zero músicas à frente', () => {
    let state = propose(emptyState, 'Ana', 'a1');
    state = reducer(state, { type: 'APPROVE_ENTRY', entryId: state.pendingQueue[0].id });

    const progress = trackTicket(state, ticket);
    expect(progress.stage === 'queued' && progress.ahead).toBe(0);
  });

  it('reconhece a apresentação em andamento e depois a concluída', () => {
    let state = propose(emptyState, 'Ana', 'a1');
    state = reducer(state, { type: 'APPROVE_ENTRY', entryId: state.pendingQueue[0].id });
    state = reducer(state, { type: 'START_PLAYING', entryId: state.queue[0].id });
    expect(trackTicket(state, ticket).stage).toBe('playing');

    state = reducer(state, { type: 'FINISH_PLAYING' });
    expect(trackTicket(state, ticket).stage).toBe('done');
  });

  it('solicitação recusada some de todas as listas', () => {
    let state = propose(emptyState, 'Ana', 'a1');
    state = reducer(state, { type: 'REJECT_ENTRY', entryId: state.pendingQueue[0].id });
    expect(trackTicket(state, ticket).stage).toBe('unknown');
  });

  it('não confunde outra pessoa com a mesma música', () => {
    const state = propose(emptyState, 'Carlos', 'a1');
    expect(trackTicket(state, ticket).stage).toBe('unknown');
  });
});
