import type { QueueEntry } from '../types';

/**
 * Chamada do próximo cantor pelo WhatsApp.
 *
 * Não é push de verdade: é o esquema `wa.me`, que abre o WhatsApp Web (ou o app
 * no celular) com a conversa e a mensagem já escritas, faltando o Host apertar
 * enviar. A escolha é deliberada — push real exigiria a WhatsApp Business API,
 * com cadastro de empresa, aprovação de template e custo por mensagem, o que
 * não se justifica para avisar quatro pessoas por noite.
 *
 * O custo: o envio depende do clique do Host. Por isso a interface marca quem
 * já foi chamado, em vez de fingir que a mensagem saiu sozinha.
 */

/** DDI do Brasil. Único mercado do produto hoje. */
const DDI_BRASIL = '55';

/**
 * Converte o telefone digitado para o formato que o `wa.me` espera: só dígitos,
 * com DDI. O participante digita "51 99999-0000"; o WhatsApp quer
 * "5551999990000".
 *
 * Devolve null quando o número não tem cara de telefone brasileiro válido —
 * melhor não oferecer o botão do que abrir uma conversa com número errado.
 */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');

  // Já veio com DDI: 55 + DDD (2) + número (8 ou 9).
  if (digits.length === 12 || digits.length === 13) {
    return digits.startsWith(DDI_BRASIL) ? digits : null;
  }

  // DDD + número, sem DDI.
  if (digits.length === 10 || digits.length === 11) {
    return `${DDI_BRASIL}${digits}`;
  }

  return null;
}

/** O Host consegue chamar esta pessoa? */
export function canNotify(entry: Pick<QueueEntry, 'phone'>): boolean {
  return normalizePhone(entry.phone) !== null;
}

/**
 * Mensagem da chamada.
 *
 * Curta de propósito: o participante lê isso numa tela de bloqueio, em pé, num
 * bar barulhento. Precisa responder "é a minha vez?" na primeira linha.
 */
export function buildCallMessage(entry: QueueEntry, isNext: boolean): string {
  const chamada = isNext
    ? `${entry.participant}, é a sua vez! 🎤`
    : `${entry.participant}, prepare-se — você está chegando! 🎤`;

  return [
    chamada,
    '',
    `Música: ${entry.song.title}`,
    entry.song.artist ? `Artista: ${entry.song.artist}` : '',
    '',
    'Vem pro palco. Karaokê Just Go',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Link que abre a conversa com a mensagem pronta.
 *
 * `wa.me` é o domínio oficial de encurtamento do WhatsApp e resolve sozinho
 * para o app no celular ou para o WhatsApp Web no desktop — não é preciso
 * detectar a plataforma.
 */
export function buildWhatsAppUrl(entry: QueueEntry, isNext: boolean): string | null {
  const phone = normalizePhone(entry.phone);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildCallMessage(entry, isNext))}`;
}

/**
 * Abre a conversa numa aba nova.
 *
 * `noopener` importa: sem ele a página do WhatsApp recebe uma referência ao
 * painel do Host pelo `window.opener`.
 */
export function openWhatsApp(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
