import { describe, it, expect } from 'vitest';
import {
  canTransition,
  transition,
  isOpenForParticipants,
  isTerminal,
  InvalidSessionTransitionError,
} from '@/domain/session/state-machine';

describe('máquina de estados da sessão', () => {
  it('permite o fluxo feliz completo', () => {
    expect(canTransition('SCHEDULED', 'OPEN')).toBe(true);
    expect(canTransition('OPEN', 'LIVE')).toBe(true);
    expect(canTransition('LIVE', 'CLOSED')).toBe(true);
  });

  it('permite encerrar antecipadamente de qualquer estado não terminal', () => {
    expect(canTransition('SCHEDULED', 'CLOSED')).toBe(true);
    expect(canTransition('OPEN', 'CLOSED')).toBe(true);
  });

  it('impede pular etapas', () => {
    expect(canTransition('SCHEDULED', 'LIVE')).toBe(false);
  });

  it('impede voltar no fluxo', () => {
    expect(canTransition('LIVE', 'OPEN')).toBe(false);
    expect(canTransition('CLOSED', 'LIVE')).toBe(false);
  });

  it('não permite nenhuma transição a partir de CLOSED', () => {
    expect(canTransition('CLOSED', 'OPEN')).toBe(false);
    expect(canTransition('CLOSED', 'CLOSED')).toBe(false);
  });

  it('lança InvalidSessionTransitionError em transição inválida', () => {
    expect(() => transition('SCHEDULED', 'LIVE')).toThrow(InvalidSessionTransitionError);
  });

  it('retorna o novo estado em transição válida', () => {
    expect(transition('OPEN', 'LIVE')).toBe('LIVE');
  });

  it('só considera aberto para participantes OPEN e LIVE', () => {
    expect(isOpenForParticipants('SCHEDULED')).toBe(false);
    expect(isOpenForParticipants('OPEN')).toBe(true);
    expect(isOpenForParticipants('LIVE')).toBe(true);
    expect(isOpenForParticipants('CLOSED')).toBe(false);
  });

  it('identifica CLOSED como estado terminal', () => {
    expect(isTerminal('CLOSED')).toBe(true);
    expect(isTerminal('OPEN')).toBe(false);
  });
});
