import { describe, it, expect } from 'vitest';
import { xpFor, totalXp, DEFAULT_XP_TABLE, type XpTable } from '@/domain/gamification/xp';

describe('XP', () => {
  it('usa os defaults da seção 25', () => {
    expect(xpFor('SING')).toBe(100);
    expect(xpFor('JOIN_SESSION')).toBe(20);
    expect(xpFor('VOTE')).toBe(10);
  });

  it('soma múltiplos eventos', () => {
    expect(totalXp(['JOIN_SESSION', 'SING', 'VOTE'])).toBe(130);
  });

  it('respeita tabela customizada (valores configuráveis)', () => {
    const custom: XpTable = { ...DEFAULT_XP_TABLE, SING: 250 };
    expect(xpFor('SING', custom)).toBe(250);
    expect(totalXp(['SING', 'VOTE'], custom)).toBe(260);
  });
});
