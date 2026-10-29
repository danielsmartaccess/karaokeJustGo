import { useEffect } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KaraokeAction } from '@/store/actions';
import { KaraokeProvider, useKaraoke } from '@/store/KaraokeContext';
import { TelaoScreen } from '@/components/telao/TelaoScreen';
import type { ScreenContent } from '@/types';

/**
 * ATENÇÃO: o Vitest carrega o .env local. Sem este mock, montar o provedor num
 * ambiente com as chaves do Supabase conectaria ao banco REAL e gravaria nele
 * as ações disparadas pelos testes. Aqui o modo demo é fixado de propósito.
 */
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  ROOM_SLUG: 'teste',
  getSupabase: () => {
    throw new Error('o Supabase não pode ser usado em teste unitário');
  },
}));

/**
 * O preview do Host era uma segunda implementação da tela, desenhada em
 * miniatura, e divergia da TV em tudo (cabeçalho, contador, rótulos, título da
 * publicidade). Agora TV e espelho renderizam o MESMO componente. Estes testes
 * seguram essa promessa: se alguém bifurcar o espelho de novo, o texto que cada
 * um mostra deixa de ser igual e o teste cai.
 */

function Harness({ actions }: { actions: KaraokeAction[] }) {
  const { dispatch } = useKaraoke();
  useEffect(() => {
    actions.forEach(dispatch);
    // Aplica uma vez, na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <div data-testid="tv">
        <TelaoScreen variant="tv" />
      </div>
      <div data-testid="mirror">
        <TelaoScreen variant="mirror" />
      </div>
    </>
  );
}

function renderBoth(actions: KaraokeAction[] = []) {
  const utils = render(
    <KaraokeProvider>
      <Harness actions={actions} />
    </KaraokeProvider>,
  );
  const tv = utils.getByTestId('tv');
  const mirror = utils.getByTestId('mirror');
  return { tv, mirror };
}

const publish = (content: ScreenContent): KaraokeAction => ({
  type: 'SET_TELAO_CONTENT',
  content,
});

const cta: ScreenContent = {
  id: 'cta-1',
  type: 'cta',
  title: 'Quem vai ser o próximo?',
  content: '🎤 Quem vai ser o próximo?',
  duration: 30,
  priority: 3,
};

const notice: ScreenContent = {
  id: 'notice-1',
  type: 'notice',
  title: 'Última chamada do bar',
  duration: 45,
  priority: 2,
};

const ad: ScreenContent = {
  id: 'ad-1',
  type: 'ad',
  title: 'Caipirinha em dobro',
  imageUrl: 'https://exemplo.test/banner.jpg',
  duration: null,
  priority: 4,
};

const qrcode: ScreenContent = {
  id: 'qr-1',
  type: 'qrcode',
  title: 'QR Code de Entrada',
  duration: null,
  priority: 1,
};

afterEach(cleanup);

describe('o espelho do Host mostra a mesma tela da TV', () => {
  const cenarios: [string, KaraokeAction[], string[]][] = [
    ['karaokê em andamento', [], ['AO VIVO', 'Agora Cantando', 'Ana', 'Evidências']],
    ['chamada para ação', [publish(cta)], ['AO VIVO', 'Quem vai ser o próximo?', '30s']],
    ['aviso', [publish(notice)], ['AO VIVO', 'Aviso', 'Última chamada do bar', '45s']],
    ['publicidade', [publish(ad)], ['Publicidade', 'Caipirinha em dobro']],
    ['QR code', [publish(qrcode)], ['AO VIVO', 'Escaneie e Cante!']],
    [
      'telão desligado',
      [{ type: 'SET_TELAO_ONLINE', online: false }],
      ['Telão Offline', 'O telão está desconectado pelo Host.'],
    ],
  ];

  it.each(cenarios)('%s', (_nome, actions, esperado) => {
    const { tv, mirror } = renderBoth(actions);

    // Igualdade total do texto: cabeçalho, rótulos, título e contador.
    expect(tv.textContent).toBeTruthy();
    expect(mirror.textContent).toBe(tv.textContent);

    for (const texto of esperado) {
      expect(tv.textContent).toContain(texto);
      expect(mirror.textContent).toContain(texto);
    }
  });

  it('publicidade ocupa a tela sem cabeçalho, nos dois', () => {
    const { tv, mirror } = renderBoth([publish(ad)]);

    expect(tv.textContent).not.toContain('AO VIVO');
    expect(mirror.textContent).not.toContain('AO VIVO');
  });
});

describe('o vídeo no espelho', () => {
  it('a TV abre o player do YouTube; o espelho mostra a miniatura, sem segundo player', () => {
    const { tv, mirror } = renderBoth();

    const player = tv.querySelector('iframe');
    expect(player?.getAttribute('src')).toContain('youtube.com/embed/');

    // Um segundo player gastaria a internet do bar junto com a TV e tocaria
    // áudio no notebook do Host.
    expect(mirror.querySelector('iframe')).toBeNull();
    expect(mirror.querySelector('img')).not.toBeNull();
  });

  it('o botão de tela cheia do espelho não recebe foco', () => {
    const { mirror } = renderBoth();

    const botao = mirror.querySelector('button[title="Tela cheia"]');
    expect(botao?.getAttribute('tabindex')).toBe('-1');
    expect(botao?.getAttribute('aria-hidden')).toBe('true');
  });
});
