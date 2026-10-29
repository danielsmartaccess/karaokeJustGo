/**
 * Área de projeto da tela do telão.
 *
 * A TV real ocupa a janela inteira. O espelho do Host renderiza a MESMA tela
 * nesta área fixa e depois a reduz por transform, então tudo se comporta como
 * numa TV Full HD, qualquer que seja o aparelho do Host.
 */
export const TELAO_CANVAS = { width: 1920, height: 1080 } as const;

/** Fator de redução para caber a área de projeto numa caixa de `containerWidth` px. */
export function mirrorScale(containerWidth: number): number {
  return containerWidth > 0 ? containerWidth / TELAO_CANVAS.width : 0;
}
