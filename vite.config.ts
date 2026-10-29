import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Base path público do app, na ordem de precedência:
//   1. BASE_PATH, quando definida (ex.: BASE_PATH=/ para servir na raiz do domínio);
//   2. '/' quando o build roda na Vercel (variável de sistema VERCEL);
//   3. '/karaokeJustGo/', o padrão do GitHub Pages, que serve o app em
//      https://<user>.github.io/karaokeJustGo/ e exige que o caminho bata com
//      o nome do repositório.
const BASE = process.env.BASE_PATH ?? (process.env.VERCEL ? '/' : '/karaokeJustGo/');

// O manifest do PWA (scope e start_url) usa BASE como está; sem as barras nas
// pontas ele sairia inválido sem nenhum erro de build.
if (!/^\/([^/]+\/)*$/.test(BASE)) {
  throw new Error(`BASE_PATH inválida: "${BASE}". Use "/" ou um caminho como "/app/".`);
}

export default defineConfig({
  base: BASE,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Karaokê Just Go',
        short_name: 'JG Karaokê',
        description: 'Plataforma de entretenimento para bares — fila, telão e Host',
        theme_color: '#06000e',
        background_color: '#06000e',
        display: 'standalone',
        orientation: 'portrait',
        scope: BASE,
        start_url: BASE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
