import { describe, expect, it } from 'vitest';
import { createLatestGate } from '@/lib/latestGate';
import { mirrorScale, TELAO_CANVAS } from '@/lib/telao';

/**
 * Cada mudança no banco dispara uma releitura da sala. Iniciar uma música, por
 * exemplo, atualiza duas linhas e gera duas leituras em voo. Se a antiga
 * terminar por último, sobrescreve o estado novo com um velho e o aparelho
 * fica errado até o próximo evento.
 */
describe('ordenação das leituras da sala', () => {
  it('aceita uma única leitura', () => {
    const gate = createLatestGate();
    expect(gate.accept(gate.begin())).toBe(true);
  });

  it('descarta a resposta antiga que chega depois da mais nova', () => {
    const gate = createLatestGate();
    const antiga = gate.begin();
    const nova = gate.begin();

    expect(gate.accept(nova)).toBe(true);
    expect(gate.accept(antiga)).toBe(false);
  });

  it('aceita a antiga se ela chega antes da mais nova', () => {
    const gate = createLatestGate();
    const antiga = gate.begin();
    const nova = gate.begin();

    expect(gate.accept(antiga)).toBe(true);
    expect(gate.accept(nova)).toBe(true);
  });

  it('aceita a antiga se a mais nova falhou e nunca foi aplicada', () => {
    const gate = createLatestGate();
    const antiga = gate.begin();
    gate.begin(); // a leitura mais nova falha: nunca chama accept

    expect(gate.accept(antiga)).toBe(true);
  });

  it('não aplica a mesma leitura duas vezes', () => {
    const gate = createLatestGate();
    const ticket = gate.begin();

    expect(gate.accept(ticket)).toBe(true);
    expect(gate.accept(ticket)).toBe(false);
  });
});

describe('escala do espelho do telão', () => {
  it('reduz a área de projeto Full HD até caber na largura do painel', () => {
    expect(TELAO_CANVAS).toEqual({ width: 1920, height: 1080 });
    expect(mirrorScale(960)).toBe(0.5);
    expect(mirrorScale(1920)).toBe(1);
  });

  it('devolve zero enquanto o painel ainda não tem largura', () => {
    expect(mirrorScale(0)).toBe(0);
  });
});
