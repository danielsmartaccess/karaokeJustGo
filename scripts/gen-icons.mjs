/**
 * Gera os ícones do PWA a partir da marca real (glifo "Go" extraído do logo oficial
 * — ver scripts/assets/go-mark-white.png). Fundo azul da marca (#01ADEF), glifo
 * branco centralizado com margem generosa (~22%) para servir também como ícone
 * maskable (vite.config.ts reaproveita icon-512.png com purpose: 'maskable').
 * Uso: node scripts/gen-icons.mjs
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public');
const GLYPH = join(__dirname, 'assets', 'go-mark-white.png');
mkdirSync(OUT, { recursive: true });

const BRAND_BLUE = { r: 0x01, g: 0xad, b: 0xef, alpha: 1 };
const SAFE_MARGIN = 0.22;

async function makeIcon(size) {
  const glyphSize = Math.round(size * (1 - SAFE_MARGIN * 2));
  const glyph = await sharp(GLYPH).resize(glyphSize, glyphSize, { fit: 'inside' }).toBuffer();
  const glyphMeta = await sharp(glyph).metadata();

  const buffer = await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_BLUE },
  })
    .composite([
      {
        input: glyph,
        left: Math.round((size - glyphMeta.width) / 2),
        top: Math.round((size - glyphMeta.height) / 2),
      },
    ])
    .png()
    .toBuffer();

  writeFileSync(join(OUT, `icon-${size}.png`), buffer);
  console.log(`icon-${size}.png gerado`);
  return buffer;
}

async function makeFavicon() {
  const png = await sharp({
    create: { width: 128, height: 128, channels: 4, background: BRAND_BLUE },
  })
    .composite([
      {
        input: await sharp(GLYPH).resize(88, 88, { fit: 'inside' }).toBuffer(),
        left: 20,
        top: 24,
      },
    ])
    .png()
    .toBuffer();

  const b64 = png.toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <image href="data:image/png;base64,${b64}" width="128" height="128"/>
</svg>
`;
  writeFileSync(join(OUT, 'favicon.svg'), svg);
  console.log('favicon.svg gerado');
}

for (const size of [192, 512]) {
  await makeIcon(size);
}
await makeFavicon();
