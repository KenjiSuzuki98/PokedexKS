import { parse, type HTMLElement } from 'node-html-parser';

export interface CostumeData {
  /** Âncora da fantasia na página (costume-<slug>). */
  slug: string;
  name: string;
  shiny: boolean;
  /** Fantasias equivalentes nas evoluções (página + âncora). */
  evolvesTo: { path: string; slug: string }[];
}

export interface PageData {
  path: string;
  slug: string;
  dex: number;
  name: string;
  /** Forma mostrada na página base, quando o título a traz entre parênteses (ex.: "Manto vegetal"). */
  defaultForm: string | null;
  /** false quando o site diz que ainda não há imagens do jogo (não lançado). */
  inGame: boolean;
  shiny: boolean;
  base: { atk: number; def: number; sta: number } | null;
  /** Nome da pré-evolução, como escrito no site. */
  evolvesFrom: string | null;
  mega: boolean;
  dynamax: boolean;
  gigamax: boolean;
  /** Subpáginas de forma (exceto Mega e counters). */
  forms: { path: string; label: string }[];
  costumes: CostumeData[];
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function articleByHeading(root: HTMLElement, test: (h: string) => boolean): HTMLElement | undefined {
  return root.querySelectorAll('article').find((a) => {
    const h = a.querySelector('h2');
    return h ? test(clean(h.text)) : false;
  });
}

function baseStats(root: HTMLElement): PageData['base'] {
  const art = articleByHeading(root, (h) => h === 'Atributos base');
  if (!art) return null;
  const value = (label: string) => {
    const row = art.querySelectorAll('tr').find((tr) => clean(tr.querySelector('td')?.text ?? '') === label);
    const cells = row?.querySelectorAll('td') ?? [];
    return Number(clean(cells[cells.length - 1]?.text ?? ''));
  };
  const stats = { atk: value('Ataque'), def: value('Defesa'), sta: value('Vigor') };
  return Object.values(stats).every((v) => Number.isFinite(v) && v > 0) ? stats : null;
}

function evolvesFrom(root: HTMLElement): string | null {
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const desc = String(JSON.parse(s.text).description ?? '');
      // A frase seguinte do site começa com "É ..."; isso evita cortar nomes como "Mr. Mime".
      const m = desc.match(/que evolui de (.+?)\.(?=\s+É\s|\s*$)/) ?? desc.match(/que evolui de (.+?)\./);
      if (m) return m[1]!.trim();
    } catch {
      // JSON inválido: ignora
    }
  }
  return null;
}

function costumes(root: HTMLElement): CostumeData[] {
  return root.querySelectorAll('[id^="costume-"]').map((el) => {
    const title = clean(el.querySelector('p')?.text ?? '');
    const name = title.match(/\((.*)\)$/)?.[1] ?? title;
    const evolvesTo = el
      .querySelectorAll('li a')
      .map((a) => a.getAttribute('href') ?? '')
      .map((href) => href.match(/^(\/pt-br\/pokemon\/[^#]+)#costume-(.+)$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => ({ path: m[1]!, slug: m[2]! }));
    const shiny = el.querySelectorAll('img[alt]').some((i) => /\(Brilhante/.test(i.getAttribute('alt') ?? ''));
    return { slug: el.id.replace(/^costume-/, ''), name, shiny, evolvesTo };
  });
}

export function parseSpeciesPage(html: string, path: string): PageData {
  const root = parse(html);
  const m = path.match(/\/pokemon\/(\d+)-([^/]+)/);
  if (!m) throw new Error(`Caminho inesperado: ${path}`);
  const text = root.text;
  const title = clean(root.querySelector('h1')?.text ?? '');
  const titleParts = title.match(/^(.+?) \((.+)\)$/);

  const images = articleByHeading(root, (h) => h === 'Imagens do jogo');
  const shiny = !!images?.querySelectorAll('img[alt]').some((i) => /\(Brilhante/.test(i.getAttribute('alt') ?? ''));

  const formsArt = articleByHeading(root, (h) => h === 'Formas');
  const subpages = (formsArt?.querySelectorAll('a') ?? [])
    .map((a) => ({ path: a.getAttribute('href') ?? '', label: clean(a.text) }))
    .filter((f) => f.path.startsWith(path + '/'));
  const allLinks = root.querySelectorAll('a').map((a) => a.getAttribute('href') ?? '');

  const maxArt = root.querySelectorAll('article').find((a) => a.text.includes('Movimento Max'));
  const maxText = maxArt ? maxArt.text.slice(maxArt.text.indexOf('Movimento Max')) : '';

  return {
    path,
    slug: m[2]!,
    dex: Number(m[1]),
    name: titleParts ? titleParts[1]! : title,
    defaultForm: titleParts ? titleParts[2]! : null,
    inGame: !text.includes('Ainda não há imagens do jogo'),
    shiny,
    base: baseStats(root),
    evolvesFrom: evolvesFrom(root),
    mega: allLinks.some((href) => href.startsWith(path + '/megaevolucao')),
    dynamax: !!maxArt,
    gigamax: /Gigamax|G-Max/.test(maxText),
    forms: subpages.filter((f) => !/\/(megaevolucao|counters)/.test(f.path.slice(path.length))),
    costumes: costumes(root),
  };
}

/** Caminhos pt-br da página base de cada espécie do sitemap, sem repetir. */
export function speciesPathsFromSitemap(xml: string): string[] {
  // Algumas espécies só aparecem pelas formas (ex.: Burmy); a página base redireciona para a forma padrão.
  const paths = [...xml.matchAll(/<loc>https?:\/\/[^/]+\/[a-z-]+\/pokemon\/(\d+-[^/<]+)(?:\/[^<]*)?<\/loc>/g)].map(
    (m) => `/pt-br/pokemon/${m[1]}`,
  );
  return [...new Set(paths)];
}
