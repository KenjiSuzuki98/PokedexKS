import { parseSpeciesPage, speciesPathsFromSitemap } from './parse';

// HTML mínimo com a mesma estrutura das páginas de pokemon.gameinfo.io/pt-br.
function page(o: {
  name: string;
  path: string;
  evolvesFrom?: string;
  noImages?: boolean;
  shiny?: boolean;
  max?: string[];
  forms?: [string, string][];
  costumes?: string;
  stats?: [number, number, number];
}) {
  const [atk, def, sta] = o.stats ?? [112, 96, 111];
  const desc = `${o.name} é um Pokémon Elétrico${o.evolvesFrom ? ` que evolui de ${o.evolvesFrom}` : ''}. É fraco contra ataques do tipo Terrestre.`;
  const stat = (label: string, v: number) => `<tr><td>${label}</td><td><div style="width: calc(${v} / 414 * 100%)"></div></td><td>${v}</td></tr>`;
  return `<html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'Intangible', name: o.name, description: desc })}</script></head><body>
  <article><h1 class="text-3xl">
    ${o.name}
  </h1></article>
  <article><h2>Formas</h2>
    <a href="${o.path}">Normal</a>
    ${(o.forms ?? []).map(([href, label]) => `<a href="${href}"><img alt="x"><span>${label}</span></a>`).join('')}
    <a href="#costumes">Ver fantasias »</a>
  </article>
  <article><h2>Imagens do jogo</h2>
    ${o.noImages ? '<p>Ainda não há imagens do jogo para este Pokémon.</p>' : `<p>${o.name}${o.shiny ? ', com a versão brilhante à direita' : ''}.</p>`}
    ${o.noImages ? '' : `<img alt="${o.name} (Macho) em Pokémon GO">`}
    ${o.shiny ? `<img alt="${o.name} (Brilhante, Macho) em Pokémon GO">` : ''}
  </article>
  <article><h2>Todos os ataques</h2><table><tr><td>Ataque Rápido</td></tr></table>
    ${o.max ? `<table><tr><td>Movimento Max</td></tr>${o.max.map((m) => `<tr><td>${m}</td></tr>`).join('')}</table>` : ''}
  </article>
  <article><h2>Atributos base</h2><table>${stat('Ataque', atk)}${stat('Defesa', def)}${stat('Vigor', sta)}</table></article>
  ${o.costumes ?? ''}
  </body></html>`;
}

describe('parseSpeciesPage', () => {
  it('lê nome, Nº, atributos base, brilhante e evolução', () => {
    const p = parseSpeciesPage(page({ name: 'Raichu', path: '/pt-br/pokemon/26-raichu', evolvesFrom: 'Pikachu', shiny: true, stats: [193, 151, 155] }), '/pt-br/pokemon/26-raichu');
    expect(p).toMatchObject({
      path: '/pt-br/pokemon/26-raichu', slug: 'raichu', dex: 26, name: 'Raichu', inGame: true, shiny: true,
      base: { atk: 193, def: 151, sta: 155 }, evolvesFrom: 'Pikachu',
    });
  });

  it('sem pré-evolução e sem brilhante', () => {
    const p = parseSpeciesPage(page({ name: 'Pichu', path: '/pt-br/pokemon/172-pichu' }), '/pt-br/pokemon/172-pichu');
    expect(p.evolvesFrom).toBeNull();
    expect(p.shiny).toBe(false);
  });

  it('espécie que ainda não está no jogo', () => {
    const p = parseSpeciesPage(page({ name: 'Terapagos', path: '/pt-br/pokemon/1024-terapagos', noImages: true }), '/pt-br/pokemon/1024-terapagos');
    expect(p.inGame).toBe(false);
  });

  it('Mega pelas subpáginas de megaevolução; formas sem Mega e sem fantasias', () => {
    const p = parseSpeciesPage(
      page({
        name: 'Raichu',
        path: '/pt-br/pokemon/26-raichu',
        forms: [
          ['/pt-br/pokemon/26-raichu/megaevolucao-x', 'Megaevolução X'],
          ['/pt-br/pokemon/26-raichu/megaevolucao-y', 'Megaevolução Y'],
          ['/pt-br/pokemon/26-raichu/forma-de-alola', 'Forma de Alola'],
        ],
      }),
      '/pt-br/pokemon/26-raichu',
    );
    expect(p.mega).toBe(true);
    expect(p.forms).toEqual([{ path: '/pt-br/pokemon/26-raichu/forma-de-alola', label: 'Forma de Alola' }]);
  });

  it('Dinamax pela seção de Movimentos Max; Gigamax pelo movimento G-Max', () => {
    const path = '/pt-br/pokemon/6-charizard';
    expect(parseSpeciesPage(page({ name: 'Charizard', path }), path)).toMatchObject({ dynamax: false, gigamax: false });
    expect(parseSpeciesPage(page({ name: 'Charizard', path, max: ['Chama Max'] }), path)).toMatchObject({ dynamax: true, gigamax: false });
    expect(parseSpeciesPage(page({ name: 'Charizard', path, max: ['Queimada G-Max Gigamax', 'Chama Max'] }), path)).toMatchObject({
      dynamax: true,
      gigamax: true,
    });
  });

  it('fantasias: nome, brilhante e para qual fantasia evolui', () => {
    const costumes = `<article><h2>Fantasias de Charmander</h2>
      <div id="costume-chapeu-de-festa"><p>Charmander (Chapéu de festa)</p><ul><li>Não pode evoluir.</li></ul>
        <img alt="Charmander (Chapéu de festa) em Pokémon GO"></div>
      <div id="costume-goggles-2026"><p>
        Charmander (Goggles 2026)
      </p><ul><li>Charmander (Goggles 2026) evolui para <a href="/pt-br/pokemon/5-charmeleon#costume-goggles-2026">Charmeleon (Goggles 2026)</a>.</li></ul>
        <img alt="Charmander (Goggles 2026) em Pokémon GO"><img alt="Charmander (Goggles 2026) (Brilhante) em Pokémon GO"></div>
    </article>`;
    const p = parseSpeciesPage(page({ name: 'Charmander', path: '/pt-br/pokemon/4-charmander', costumes }), '/pt-br/pokemon/4-charmander');
    expect(p.costumes).toEqual([
      { slug: 'chapeu-de-festa', name: 'Chapéu de festa', shiny: false, evolvesTo: [] },
      { slug: 'goggles-2026', name: 'Goggles 2026', shiny: true, evolvesTo: [{ path: '/pt-br/pokemon/5-charmeleon', slug: 'goggles-2026' }] },
    ]);
  });

  it('variantes (ex.: letras do Unown) entram como fantasias', () => {
    const costumes = `<article><h2>Variantes de Unown</h2>
      <div id="costume-a"><p>Unown (A)</p><img alt="Unown (A) (Brilhante) em Pokémon GO"></div></article>`;
    const p = parseSpeciesPage(page({ name: 'Unown', path: '/pt-br/pokemon/201-unown', costumes }), '/pt-br/pokemon/201-unown');
    expect(p.costumes).toEqual([{ slug: 'a', name: 'A', shiny: true, evolvesTo: [] }]);
  });
});

describe('nome com forma padrão e nomes com ponto', () => {
  it('separa a forma padrão do título', () => {
    const p = parseSpeciesPage(page({ name: 'Burmy (Manto vegetal)', path: '/pt-br/pokemon/412-burmy' }), '/pt-br/pokemon/412-burmy');
    expect(p).toMatchObject({ name: 'Burmy', defaultForm: 'Manto vegetal' });
    const q = parseSpeciesPage(page({ name: 'Pikachu', path: '/pt-br/pokemon/25-pikachu' }), '/pt-br/pokemon/25-pikachu');
    expect(q.defaultForm).toBeNull();
  });

  it('pré-evolução com ponto no nome', () => {
    const p = parseSpeciesPage(page({ name: 'Mr. Rime', path: '/pt-br/pokemon/866-mr-rime', evolvesFrom: 'Mr. Mime' }), '/pt-br/pokemon/866-mr-rime');
    expect(p).toMatchObject({ name: 'Mr. Rime', evolvesFrom: 'Mr. Mime' });
  });
});

describe('speciesPathsFromSitemap', () => {
  it('pega só as páginas base de cada espécie, em pt-br, sem repetir', () => {
    const xml = `<urlset>
      <url><loc>https://pokemon.gameinfo.io/en/pokemon/25-pikachu</loc></url>
      <url><loc>https://pokemon.gameinfo.io/en/pokemon/25-pikachu/pop-star</loc></url>
      <url><loc>https://pokemon.gameinfo.io/en/pokemon/26-raichu</loc></url>
      <url><loc>https://pokemon.gameinfo.io/pt-br/pokemon/26-raichu</loc></url>
      <url><loc>https://pokemon.gameinfo.io/en/pokemon/412-burmy/plant-cloak</loc></url>
      <url><loc>https://pokemon.gameinfo.io/en/pokemon/412-burmy/sandy-cloak</loc></url>
      <url><loc>https://pokemon.gameinfo.io/en/moves/thunder</loc></url>
    </urlset>`;
    expect(speciesPathsFromSitemap(xml)).toEqual(['/pt-br/pokemon/25-pikachu', '/pt-br/pokemon/26-raichu', '/pt-br/pokemon/412-burmy']);
  });
});
