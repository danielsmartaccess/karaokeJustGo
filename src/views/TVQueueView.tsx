import { TelaoScreen } from '../components/telao/TelaoScreen';

/**
 * Rota #/telao: a tela inteira que vai para a TV.
 *
 * Toda a composição vive em TelaoScreen, a mesma tela que o painel do Host
 * espelha. Este arquivo existe só para dar nome à rota.
 */
export default function TVQueueView() {
  return <TelaoScreen variant="tv" />;
}
