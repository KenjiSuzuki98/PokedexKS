// Baixa pokemon.gameinfo.io/pt-br e gera src/data/species.json.
// Uso: npm run import:gameinfo   (páginas ficam em cache em .cache/gameinfo)
import fs from 'node:fs';
import path from 'node:path';
import { buildSpeciesTable, type SpeciesSource } from './build';
import { parseSpeciesPage, speciesPathsFromSitemap } from './parse';
import type { Species } from '../../src/core/types';

const SITE = 'https://pokemon.gameinfo.io';
const GENDERS_CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv';
const CACHE = path.resolve('.cache/gameinfo');
const OUT = path.resolve('src/data/species.json');
const CONCURRENCY = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, cacheName: string): Promise<string> {
  const file = path.join(CACHE, cacheName);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'PokedexKS-importer (uso pessoal)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
      await sleep(250);
      return text;
    } catch (err) {
      if (attempt >= 3) throw new Error(`${url}: ${(err as Error).message}`);
      await sleep(2000 * attempt);
    }
  }
}

const pageFile = (p: string) => p.replace(/^\/pt-br\/pokemon\//, '').replace(/\//g, '__') + '.html';

async function mapLimit<T, R>(items: T[], fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}

async function main() {
  const sitemap = await get(`${SITE}/sitemap-pokemon.xml`, 'sitemap-pokemon.xml');
  const paths = speciesPathsFromSitemap(sitemap);
  console.log(`${paths.length} espécies no sitemap`);

  let done = 0;
  const sources: SpeciesSource[] = await mapLimit(paths, async (p) => {
    const base = parseSpeciesPage(await get(SITE + p, pageFile(p)), p);
    const forms = [];
    for (const f of base.forms) forms.push({ label: f.label, page: parseSpeciesPage(await get(SITE + f.path, pageFile(f.path)), f.path) });
    if (++done % 50 === 0) console.log(`  ${done}/${paths.length}`);
    return { base, forms };
  });

  const csv = await get(GENDERS_CSV, 'pokemon_species.csv');
  const [head, ...rows] = csv.trim().split('\n').map((l) => l.split(','));
  const idCol = head!.indexOf('id');
  const rateCol = head!.indexOf('gender_rate');
  const genders = new Map(rows.map((r) => [Number(r[idCol]), Number(r[rateCol])]));

  const previous = JSON.parse(fs.readFileSync(OUT, 'utf8')) as Species[];
  const { species, warnings } = buildSpeciesTable(sources, genders, previous);
  fs.writeFileSync(OUT, JSON.stringify(species, null, 2) + '\n');

  const costumes = species.reduce((n, s) => n + s.costumes.length, 0);
  console.log(`${species.length} espécies/formas no jogo, ${costumes} fantasias/variantes -> ${OUT}`);
  if (warnings.length) console.log(`${warnings.length} aviso(s):\n  ` + warnings.join('\n  '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
