/**
 * Rotas da aplicação.
 *
 * Usamos hash routing porque o app é publicado no GitHub Pages sob um
 * subcaminho (/karaokeJustGo/). Com hash, abrir o telão direto na TV ou o
 * painel no notebook funciona sem nenhuma regra de reescrita no servidor.
 */
import type { AppView } from '../types';

export const ROUTES: Record<AppView, string> = {
  participant: '#/',
  tv: '#/telao',
  host: '#/host',
};

const HASH_TO_VIEW: Record<string, AppView> = {
  '#/': 'participant',
  '': 'participant',
  '#': 'participant',
  '#/telao': 'tv',
  '#/host': 'host',
};

export function viewFromHash(hash: string): AppView {
  return HASH_TO_VIEW[hash] ?? 'participant';
}

/** Endereço que o participante abre ao escanear o QR code do telão. */
export function participantUrl(): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${ROUTES.participant}`;
}
