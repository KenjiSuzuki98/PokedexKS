import { existsSync } from 'node:fs';
import { BASE, pwaOptions } from './pwa.config';

describe('configuração do PWA', () => {
  it('usa o caminho do GitHub Pages do repositório', () => {
    expect(BASE).toBe('/PokedexKS/');
  });

  it('manifesto instalável: nome, modo app, início dentro do app', () => {
    const m = pwaOptions.manifest!;
    expect(m).toMatchObject({ name: 'Pokédex KS', short_name: 'Pokédex KS', display: 'standalone', lang: 'pt-BR' });
    expect(m.start_url).toBe(BASE);
    expect(m.scope).toBe(BASE);
  });

  it('tem ícones 192 e 512 (com versão maskable) e os arquivos existem', () => {
    const icons = pwaOptions.manifest!.icons!;
    expect(icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
    for (const i of icons) expect(existsSync(`public/${i.src}`), i.src).toBe(true);
    expect(existsSync('public/apple-touch-icon.png')).toBe(true);
  });

  it('funciona offline e se atualiza sozinho', () => {
    expect(pwaOptions.registerType).toBe('autoUpdate');
    expect(pwaOptions.workbox?.globPatterns).toEqual(expect.arrayContaining(['**/*.{js,css,html,png,svg}']));
  });
});
