import type { VitePWAOptions } from 'vite-plugin-pwa';

/** Caminho do app no GitHub Pages (https://kenjisuzuki98.github.io/PokedexKS/). */
export const BASE = '/PokedexKS/';

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  includeAssets: ['apple-touch-icon.png'],
  manifest: {
    name: 'Pokédex KS',
    short_name: 'Pokédex KS',
    description: 'Organizador pessoal da coleção de Pokémon GO.',
    lang: 'pt-BR',
    display: 'standalone',
    start_url: BASE,
    scope: BASE,
    theme_color: '#d6342c',
    background_color: '#f6f7f9',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg}'],
  },
};
