import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyState, reducer } from '@/store/reducer';
import type { ScreenContent } from '@/types';

/**
 * Regras do telão: prioridade do karaokê, conteúdo temporário com contagem
 * regressiva e retorno automático. O relógio é derivado de `expiresAt` para
 * que telão, celular e painel do Host convirjam sem escrever no banco a cada
 * segundo.
 */

const ad: ScreenContent = {
  id: 'ad-1',
  type: 'ad',
  title: 'Happy Hour',
  imageUrl: 'https://exemplo.test/banner.jpg',
  duration: 30,
  priority: 4,
};

const manualNotice: ScreenContent = {
  id: 'notice-1',
  type: 'notice',
  title: 'FILA ENCERRADA',
  duration: null,
  priority: 2,
};

afterEach(() => {
  vi.useRealTimers();
});

describe('telão', () => {
  it('começa exibindo o karaokê', () => {
    expect(emptyState.telao.currentContent).toBeNull();
    expect(emptyState.telao.expiresAt).toBeNull();
  });

  it('publica conteúdo temporário com prazo de expiração', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T22:00:00Z'));

    const state = reducer(emptyState, { type: 'SET_TELAO_CONTENT', content: ad });

    expect(state.telao.currentContent?.id).toBe('ad-1');
    expect(state.telao.timeRemaining).toBe(30);
    expect(state.telao.expiresAt).toBe(Date.now() + 30_000);
  });

  it('retorna sozinho ao karaokê quando o tempo acaba', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T22:00:00Z'));

    const published = reducer(emptyState, { type: 'SET_TELAO_CONTENT', content: ad });
    vi.setSystemTime(new Date('2026-09-18T22:00:31Z'));
    const ticked = reducer(published, { type: 'TICK_TELAO' });

    expect(ticked.telao.currentContent).toBeNull();
    expect(ticked.telao.timeRemaining).toBeNull();
  });

  it('conta o tempo restante a partir do relógio, não de decrementos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T22:00:00Z'));

    const published = reducer(emptyState, { type: 'SET_TELAO_CONTENT', content: ad });
    vi.setSystemTime(new Date('2026-09-18T22:00:12Z'));
    const ticked = reducer(published, { type: 'TICK_TELAO' });

    expect(ticked.telao.timeRemaining).toBe(18);
  });

  it('conteúdo sem duração permanece até o Host encerrar', () => {
    const published = reducer(emptyState, {
      type: 'SET_TELAO_CONTENT',
      content: manualNotice,
    });
    const ticked = reducer(published, { type: 'TICK_TELAO' });

    expect(ticked.telao.currentContent?.id).toBe('notice-1');
    expect(ticked.telao.expiresAt).toBeNull();

    const cleared = reducer(ticked, { type: 'CLEAR_TELAO_CONTENT' });
    expect(cleared.telao.currentContent).toBeNull();
  });

  it('o Host desliga e religa o telão', () => {
    const off = reducer(emptyState, { type: 'SET_TELAO_ONLINE', online: false });
    expect(off.telao.isOnline).toBe(false);

    const on = reducer(off, { type: 'SET_TELAO_ONLINE', online: true });
    expect(on.telao.isOnline).toBe(true);
  });

  it('gerencia a biblioteca de publicidades', () => {
    const added = reducer(emptyState, {
      type: 'ADD_AD',
      ad: {
        id: 'a1',
        title: 'Caipirinha',
        imageUrl: 'https://exemplo.test/c.jpg',
        duration: 15,
        createdAt: '22:00',
      },
    });
    expect(added.telao.ads).toHaveLength(1);

    const removed = reducer(added, { type: 'REMOVE_AD', id: 'a1' });
    expect(removed.telao.ads).toHaveLength(0);
  });
});
