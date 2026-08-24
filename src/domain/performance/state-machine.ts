/**
 * Máquina de estados da apresentação (seção 10 do prompt mestre).
 *
 * QUEUED → CALLED → PERFORMING → VOTING → RESULT → COMPLETED
 *
 * As regras de transição vivem AQUI, não espalhadas por componentes React.
 * Transições inválidas são impedidas de forma explícita e testável.
 */

export const PERFORMANCE_STATES = [
  'QUEUED',
  'CALLED',
  'PERFORMING',
  'VOTING',
  'RESULT',
  'COMPLETED',
] as const;

export type PerformanceState = (typeof PERFORMANCE_STATES)[number];

/** Estado de saída além do fluxo feliz: o host pode pular/remover a qualquer momento. */
export const CANCELLED = 'CANCELLED' as const;
export type TerminalState = typeof CANCELLED;

/** Transições permitidas no fluxo normal. */
const TRANSITIONS: Record<PerformanceState, readonly PerformanceState[]> = {
  QUEUED: ['CALLED'],
  CALLED: ['PERFORMING'],
  PERFORMING: ['VOTING'],
  VOTING: ['RESULT'],
  RESULT: ['COMPLETED'],
  COMPLETED: [],
};

/** Estados a partir dos quais o host ainda pode cancelar (pular/remover). */
const CANCELLABLE: readonly PerformanceState[] = ['QUEUED', 'CALLED', 'PERFORMING'];

export function canTransition(from: PerformanceState, to: PerformanceState | TerminalState): boolean {
  if (to === CANCELLED) {
    return CANCELLABLE.includes(from);
  }
  return TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: PerformanceState,
    public readonly to: PerformanceState | TerminalState,
  ) {
    super(`Transição inválida: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Aplica uma transição, lançando erro se for inválida.
 * Retorna o novo estado (função pura — não muta nada).
 */
export function transition(
  from: PerformanceState,
  to: PerformanceState | TerminalState,
): PerformanceState | TerminalState {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  return to;
}

export function isTerminal(state: PerformanceState | TerminalState): boolean {
  return state === 'COMPLETED' || state === CANCELLED;
}
