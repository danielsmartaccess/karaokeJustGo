/**
 * Regras de votação (seções 19–23 do prompt mestre).
 *
 * Funções PURAS e testáveis. A validação definitiva também ocorre no backend
 * (RLS + Edge Function) — estas funções guiam a UI e são a fonte única das fórmulas.
 * NUNCA colocar estas fórmulas dentro de componentes React.
 */

/** Duração padrão da janela de votação, em segundos (seção 19). */
export const VOTING_WINDOW_SECONDS = 60;

/** Categorias com nota de 1 a 5 (seção 20). */
export const SCORE_CATEGORIES = ['voice', 'performance', 'charisma', 'fun'] as const;
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

export const MIN_SCORE = 1;
export const MAX_SCORE = 5;

export interface Vote {
  /** id do votante (usuário) */
  voterId: string;
  /** notas 1..5 por categoria */
  scores: Record<ScoreCategory, number>;
  /** métrica "🫶 Eu cantaria junto" — SIM/NÃO */
  wouldSingAlong: boolean;
}

export interface EligibilityContext {
  voterId: string;
  /** cantor da apresentação sendo avaliada */
  performerId: string;
  /** o votante está presente/online na sessão? */
  isPresent: boolean;
  /** o votante já registrou voto nesta apresentação? */
  hasAlreadyVoted: boolean;
  /** segundos decorridos desde a abertura da votação */
  elapsedSeconds: number;
  windowSeconds?: number;
}

export type IneligibilityReason =
  | 'SELF_VOTE'
  | 'NOT_PRESENT'
  | 'ALREADY_VOTED'
  | 'WINDOW_CLOSED';

export interface EligibilityResult {
  eligible: boolean;
  reason?: IneligibilityReason;
}

/**
 * Determina se um voto é elegível (seção 19: sem auto-voto, sem duplicado,
 * apenas presentes, apenas dentro da janela).
 */
export function checkEligibility(ctx: EligibilityContext): EligibilityResult {
  const window = ctx.windowSeconds ?? VOTING_WINDOW_SECONDS;

  if (ctx.voterId === ctx.performerId) {
    return { eligible: false, reason: 'SELF_VOTE' };
  }
  if (!ctx.isPresent) {
    return { eligible: false, reason: 'NOT_PRESENT' };
  }
  if (ctx.hasAlreadyVoted) {
    return { eligible: false, reason: 'ALREADY_VOTED' };
  }
  if (ctx.elapsedSeconds < 0 || ctx.elapsedSeconds > window) {
    return { eligible: false, reason: 'WINDOW_CLOSED' };
  }
  return { eligible: true };
}

/** Valida se uma nota individual está no intervalo permitido. */
export function isValidScore(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_SCORE && value <= MAX_SCORE;
}

/** Valida o payload de um voto completo. */
export function isValidVote(vote: Vote): boolean {
  return SCORE_CATEGORIES.every((c) => isValidScore(vote.scores[c]));
}

export interface CategoryAverages {
  voice: number;
  performance: number;
  charisma: number;
  fun: number;
}

export interface PerformanceResult {
  averages: CategoryAverages;
  /** percentual de "Eu cantaria junto" (0–100) */
  singAlongPercent: number;
  /** Nota da Plateia — média das 4 categorias */
  audienceScore: number;
  voteCount: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Calcula o resultado agregado de uma apresentação a partir dos votos válidos.
 * (seção 22). Resultado sempre agregado — nunca expõe voto individual.
 */
export function computeResult(votes: readonly Vote[]): PerformanceResult {
  const empty: PerformanceResult = {
    averages: { voice: 0, performance: 0, charisma: 0, fun: 0 },
    singAlongPercent: 0,
    audienceScore: 0,
    voteCount: 0,
  };
  if (votes.length === 0) return empty;

  const sums: Record<ScoreCategory, number> = {
    voice: 0,
    performance: 0,
    charisma: 0,
    fun: 0,
  };
  let singAlong = 0;

  for (const vote of votes) {
    for (const c of SCORE_CATEGORIES) sums[c] += vote.scores[c];
    if (vote.wouldSingAlong) singAlong += 1;
  }

  const n = votes.length;
  const averages: CategoryAverages = {
    voice: round1(sums.voice / n),
    performance: round1(sums.performance / n),
    charisma: round1(sums.charisma / n),
    fun: round1(sums.fun / n),
  };

  const audienceScore = round1(
    (averages.voice + averages.performance + averages.charisma + averages.fun) / 4,
  );

  return {
    averages,
    singAlongPercent: Math.round((singAlong / n) * 100),
    audienceScore,
    voteCount: n,
  };
}
