/**
 * Máquina de estados da sessão (docs/ARCHITECTURE.md).
 *
 * SCHEDULED → OPEN → LIVE → CLOSED
 *
 * Fluxo estritamente sequencial (sem pular etapas, sem voltar), exceto que o host
 * pode encerrar a qualquer momento antes de CLOSED — mesma ideia do CANCELLED na
 * máquina de apresentação.
 */

export const SESSION_STATES = ['SCHEDULED', 'OPEN', 'LIVE', 'CLOSED'] as const;

export type SessionState = (typeof SESSION_STATES)[number];

const TRANSITIONS: Record<SessionState, readonly SessionState[]> = {
  SCHEDULED: ['OPEN', 'CLOSED'],
  OPEN: ['LIVE', 'CLOSED'],
  LIVE: ['CLOSED'],
  CLOSED: [],
};

export function canTransition(from: SessionState, to: SessionState): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidSessionTransitionError extends Error {
  constructor(
    public readonly from: SessionState,
    public readonly to: SessionState,
  ) {
    super(`Transição de sessão inválida: ${from} → ${to}`);
    this.name = 'InvalidSessionTransitionError';
  }
}

/** Aplica uma transição, lançando erro se for inválida. Função pura — não muta nada. */
export function transition(from: SessionState, to: SessionState): SessionState {
  if (!canTransition(from, to)) {
    throw new InvalidSessionTransitionError(from, to);
  }
  return to;
}

/** Participantes só podem entrar em sessões OPEN ou LIVE (seção 32). */
export function isOpenForParticipants(state: SessionState): boolean {
  return state === 'OPEN' || state === 'LIVE';
}

export function isTerminal(state: SessionState): boolean {
  return state === 'CLOSED';
}
