import { describe, it, expect } from 'vitest';
import {
  canTransition,
  transition,
  isTerminal,
  InvalidTransitionError,
  CANCELLED,
} from '@/domain/performance/state-machine';

describe('máquina de estados da apresentação', () => {
  it('permite o fluxo feliz completo', () => {
    expect(canTransition('QUEUED', 'CALLED')).toBe(true);
    expect(canTransition('CALLED', 'PERFORMING')).toBe(true);
    expect(canTransition('PERFORMING', 'VOTING')).toBe(true);
    expect(canTransition('VOTING', 'RESULT')).toBe(true);
    expect(canTransition('RESULT', 'COMPLETED')).toBe(true);
  });

  it('impede transições que pulam etapas', () => {
    expect(canTransition('QUEUED', 'PERFORMING')).toBe(false);
    expect(canTransition('PERFORMING', 'RESULT')).toBe(false);
    expect(canTransition('QUEUED', 'COMPLETED')).toBe(false);
  });

  it('impede voltar no fluxo', () => {
    expect(canTransition('PERFORMING', 'CALLED')).toBe(false);
    expect(canTransition('COMPLETED', 'RESULT')).toBe(false);
  });

  it('lança InvalidTransitionError em transição inválida', () => {
    expect(() => transition('QUEUED', 'VOTING')).toThrow(InvalidTransitionError);
  });

  it('retorna o novo estado em transição válida', () => {
    expect(transition('CALLED', 'PERFORMING')).toBe('PERFORMING');
  });

  it('permite o host cancelar antes do resultado', () => {
    expect(canTransition('QUEUED', CANCELLED)).toBe(true);
    expect(canTransition('CALLED', CANCELLED)).toBe(true);
    expect(canTransition('PERFORMING', CANCELLED)).toBe(true);
  });

  it('não permite cancelar após entrar em votação', () => {
    expect(canTransition('VOTING', CANCELLED)).toBe(false);
    expect(canTransition('RESULT', CANCELLED)).toBe(false);
  });

  it('identifica estados terminais', () => {
    expect(isTerminal('COMPLETED')).toBe(true);
    expect(isTerminal(CANCELLED)).toBe(true);
    expect(isTerminal('PERFORMING')).toBe(false);
  });
});
