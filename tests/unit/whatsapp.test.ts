import { describe, expect, it } from 'vitest';
import { buildCallMessage, buildWhatsAppUrl, canNotify, normalizePhone } from '@/lib/whatsapp';
import type { QueueEntry } from '@/types';

/**
 * Chamada do próximo cantor pelo WhatsApp.
 *
 * O telefone é digitado à mão, no celular, por alguém em pé num bar. Chega em
 * todo formato possível — e um número malformado abre uma conversa com um
 * desconhecido, então a normalização é a parte que precisa estar certa.
 */

function entry(overrides: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id: 'q1',
    participant: 'Ana',
    phone: '51999990000',
    song: {
      id: 'x',
      title: 'Evidências',
      artist: 'Chitãozinho & Xororó',
      duration: '4:58',
      thumbnail: '',
      youtubeId: 'tfhwXKd1W_o',
      available: true,
    },
    requestedAt: '22:10',
    status: 'next',
    ...overrides,
  };
}

describe('normalizePhone', () => {
  it('acrescenta o DDI do Brasil ao celular com DDD', () => {
    expect(normalizePhone('51999990000')).toBe('5551999990000');
  });

  it('aceita telefone fixo de 10 dígitos', () => {
    expect(normalizePhone('5133334444')).toBe('555133334444');
  });

  it('ignora a máscara que o participante vê na tela', () => {
    expect(normalizePhone('51 99999-0000')).toBe('5551999990000');
    expect(normalizePhone('(51) 99999-0000')).toBe('5551999990000');
    expect(normalizePhone('+55 51 99999-0000')).toBe('5551999990000');
  });

  it('preserva o número que já veio com DDI', () => {
    expect(normalizePhone('5551999990000')).toBe('5551999990000');
  });

  it('recusa o que não parece telefone brasileiro', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('981418383')).toBeNull(); // sem DDD
    expect(normalizePhone('12345678901234567')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it('recusa 13 dígitos com DDI de outro país', () => {
    // Sem isso, um número estrangeiro viraria uma conversa com quem não é o
    // participante. Melhor esconder o botão.
    expect(normalizePhone('4915112345678')).toBeNull();
  });
});

describe('canNotify', () => {
  it('libera quem deixou telefone válido', () => {
    expect(canNotify({ phone: '51999990000' })).toBe(true);
  });

  it('bloqueia quem não deixou telefone — o campo é opcional', () => {
    expect(canNotify({ phone: undefined })).toBe(false);
    expect(canNotify({ phone: '123' })).toBe(false);
  });
});

describe('buildCallMessage', () => {
  it('avisa que é a vez quando o participante é o próximo', () => {
    const msg = buildCallMessage(entry(), true);
    expect(msg).toContain('é a sua vez');
    expect(msg).toContain('Evidências');
  });

  it('pede para se preparar quando ainda não é a vez', () => {
    const msg = buildCallMessage(entry(), false);
    expect(msg).toContain('prepare-se');
  });

  it('começa pelo nome, que é o que aparece na notificação', () => {
    expect(buildCallMessage(entry(), true).startsWith('Ana')).toBe(true);
  });
});

describe('buildWhatsAppUrl', () => {
  it('monta o link do wa.me com a mensagem codificada', () => {
    const url = buildWhatsAppUrl(entry(), true);
    expect(url).toMatch(/^https:\/\/wa\.me\/5551999990000\?text=/);
    expect(url).toContain(encodeURIComponent('Evidências'));
  });

  it('não monta link sem telefone utilizável', () => {
    expect(buildWhatsAppUrl(entry({ phone: undefined }), true)).toBeNull();
    expect(buildWhatsAppUrl(entry({ phone: 'abc' }), true)).toBeNull();
  });
});
