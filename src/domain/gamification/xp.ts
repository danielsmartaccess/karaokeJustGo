/**
 * XP — experiência por participação (seções 24–25 do prompt mestre).
 *
 * Valores CONFIGURÁVEIS — não hardcodar regras de negócio na UI.
 * Estes são apenas os defaults iniciais; a fonte real virá do banco (config por venue).
 */

export type XpEvent =
  | 'JOIN_SESSION'
  | 'SING'
  | 'VOTE'
  | 'VOTE_FIVE_PERFORMANCES'
  | 'RETURN_VENUE'
  | 'DUET';

export type XpTable = Record<XpEvent, number>;

/**
 * Defaults sugeridos pela seção 25. Sobrescrevíveis por configuração de venue.
 * `FAVORITE_SONG` saiu na FASE 10 junto com o catálogo curado (não há mais o que
 * favoritar) — o valor legado segue no enum `xp_event` do banco, sem trigger.
 */
export const DEFAULT_XP_TABLE: XpTable = {
  JOIN_SESSION: 20,
  SING: 100,
  VOTE: 10,
  VOTE_FIVE_PERFORMANCES: 50,
  RETURN_VENUE: 100,
  DUET: 75,
};

/** Retorna o XP de um evento a partir de uma tabela (default se não informada). */
export function xpFor(event: XpEvent, table: XpTable = DEFAULT_XP_TABLE): number {
  return table[event];
}

/** Soma o XP de uma sequência de eventos. */
export function totalXp(events: readonly XpEvent[], table: XpTable = DEFAULT_XP_TABLE): number {
  return events.reduce((sum, e) => sum + xpFor(e, table), 0);
}
