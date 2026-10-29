/**
 * Ordena leituras assíncronas que podem terminar fora de ordem.
 *
 * Cada mudança no banco dispara uma releitura da sala. Duas mudanças seguidas
 * (ex.: iniciar uma música atualiza duas linhas) geram duas leituras em voo; se
 * a mais antiga terminar por último, ela sobrescreveria o estado novo com um
 * estado velho e a tela ficaria errada até o próximo evento.
 *
 * Cada leitura pega um número ao começar. Só vale a resposta mais nova que já
 * chegou: uma resposta antiga é descartada se uma posterior já foi aplicada,
 * mas ainda é aceita se a posterior falhou ou não chegou.
 */
export function createLatestGate() {
  let started = 0;
  let applied = 0;

  return {
    /** Registra o início de uma leitura e devolve o seu número. */
    begin(): number {
      started += 1;
      return started;
    },
    /** A resposta de `ticket` pode ser aplicada? Marca como aplicada se sim. */
    accept(ticket: number): boolean {
      if (ticket <= applied) return false;
      applied = ticket;
      return true;
    },
  };
}
