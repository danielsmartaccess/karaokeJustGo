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
  comanda: '#/comanda',
  garcom: '#/garcom',
  gerente: '#/gerente',
};

const HASH_TO_VIEW: Record<string, AppView> = {
  '#/': 'participant',
  '': 'participant',
  '#': 'participant',
  '#/telao': 'tv',
  '#/host': 'host',
  '#/comanda': 'comanda',
  '#/garcom': 'garcom',
  '#/gerente': 'gerente',
};

/** As telas de comanda são um produto à parte do karaokê: outro provedor, outro módulo. */
export function isComandaView(view: AppView): boolean {
  return view === 'comanda' || view === 'garcom' || view === 'gerente';
}

export function viewFromHash(hash: string): AppView {
  return HASH_TO_VIEW[hash] ?? 'participant';
}

/** Endereço que o participante abre ao escanear o QR code do telão. */
export function participantUrl(): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${ROUTES.participant}`;
}
