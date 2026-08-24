import { describe, it, expect } from 'vitest';
import {
  checkEligibility,
  computeResult,
  isValidScore,
  isValidVote,
  type Vote,
  type EligibilityContext,
} from '@/domain/voting/rules';

const baseCtx: EligibilityContext = {
  voterId: 'user-1',
  performerId: 'user-2',
  isPresent: true,
  hasAlreadyVoted: false,
  elapsedSeconds: 10,
};

describe('elegibilidade de voto', () => {
  it('aprova votante presente, dentro da janela, que ainda não votou', () => {
    expect(checkEligibility(baseCtx)).toEqual({ eligible: true });
  });

  it('bloqueia auto-votação', () => {
    const r = checkEligibility({ ...baseCtx, performerId: 'user-1' });
    expect(r).toEqual({ eligible: false, reason: 'SELF_VOTE' });
  });

  it('bloqueia votante ausente', () => {
    const r = checkEligibility({ ...baseCtx, isPresent: false });
    expect(r.reason).toBe('NOT_PRESENT');
  });

  it('bloqueia voto duplicado', () => {
    const r = checkEligibility({ ...baseCtx, hasAlreadyVoted: true });
    expect(r.reason).toBe('ALREADY_VOTED');
  });

  it('bloqueia voto após a janela de 60s', () => {
    const r = checkEligibility({ ...baseCtx, elapsedSeconds: 61 });
    expect(r.reason).toBe('WINDOW_CLOSED');
  });

  it('bloqueia elapsed negativo (relógio inconsistente)', () => {
    const r = checkEligibility({ ...baseCtx, elapsedSeconds: -1 });
    expect(r.reason).toBe('WINDOW_CLOSED');
  });

  it('aceita exatamente no limite da janela', () => {
    expect(checkEligibility({ ...baseCtx, elapsedSeconds: 60 }).eligible).toBe(true);
  });
});

describe('validação de notas', () => {
  it('aceita 1..5 inteiros', () => {
    expect(isValidScore(1)).toBe(true);
    expect(isValidScore(5)).toBe(true);
  });
  it('rejeita fora do intervalo e não-inteiros', () => {
    expect(isValidScore(0)).toBe(false);
    expect(isValidScore(6)).toBe(false);
    expect(isValidScore(3.5)).toBe(false);
  });
});

describe('cálculo de resultado', () => {
  const mkVote = (v: number, p: number, c: number, f: number, sing: boolean): Vote => ({
    voterId: `u-${v}${p}${c}${f}`,
    scores: { voice: v, performance: p, charisma: c, fun: f },
    wouldSingAlong: sing,
  });

  it('retorna zeros sem votos', () => {
    const r = computeResult([]);
    expect(r.voteCount).toBe(0);
    expect(r.audienceScore).toBe(0);
    expect(r.singAlongPercent).toBe(0);
  });

  it('calcula médias por categoria com 1 casa decimal', () => {
    const votes = [mkVote(4, 5, 5, 5, true), mkVote(5, 4, 5, 5, true), mkVote(4, 5, 5, 5, false)];
    const r = computeResult(votes);
    expect(r.averages.voice).toBe(4.3); // (4+5+4)/3 = 4.333 → 4.3
    expect(r.averages.fun).toBe(5);
    expect(r.voteCount).toBe(3);
  });

  it('calcula percentual de "eu cantaria junto"', () => {
    const votes = [mkVote(3, 3, 3, 3, true), mkVote(3, 3, 3, 3, false), mkVote(3, 3, 3, 3, true)];
    expect(computeResult(votes).singAlongPercent).toBe(67); // 2/3 → 66.6 → 67
  });

  it('nota da plateia é a média das 4 categorias', () => {
    const r = computeResult([mkVote(4, 5, 5, 5, true)]);
    expect(r.audienceScore).toBe(4.8); // (4+5+5+5)/4 = 4.75 → 4.8
  });

  it('isValidVote valida todas as categorias', () => {
    expect(isValidVote(mkVote(3, 3, 3, 3, true))).toBe(true);
    expect(isValidVote(mkVote(3, 9, 3, 3, true))).toBe(false);
  });
});
