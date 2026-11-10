import { computeCollection } from './assign';
import { filterExemplars, sortExemplars } from './query';
import { makePokemonSearch, sortSpecies } from './search';
import { generateSlots } from './slots';
import { collection, ex, iv, pichuLine, species } from './test-helpers';

const alola = species({ id: 'raichu-alola', name: 'Raichu (Alola)', dex: 26, form: 'A', evolvesFrom: 'pikachu' });
const c = collection({ species: [...pichuLine, alola] });
const search = makePokemonSearch(c, generateSlots(c));
const found = (text: string) => c.species.filter((s) => search.species(s, text)).map((s) => s.id);

describe('busca de Pokémon por nome, Nº e código de renomear', () => {
  it('nome em qualquer parte, sem acento nem maiúsculas', () => {
    expect(found('rai')).toEqual(['raichu', 'raichu-alola']);
    expect(found('PÍCHU')).toEqual(['pichu']);
  });

  it('Nº Pokédex com ou sem zeros e #', () => {
    expect(found('25')).toEqual(['pikachu']);
    expect(found('0025')).toEqual(['pikachu']);
    expect(found('#026')).toEqual(['raichu', 'raichu-alola']);
  });

  it('código de renomear (inteiro ou começo) acha a espécie certa', () => {
    expect(found('0025BR')).toEqual(['pikachu']);
    expect(found('0026ev')).toEqual(['raichu']);
    expect(found('0026A')).toEqual(['raichu-alola']);
    expect(found('0026AEV')).toEqual(['raichu-alola']);
    expect(found('0025ZZZ')).toEqual([]);
  });

  it('vazio acha tudo', () => {
    expect(found('  ')).toHaveLength(4);
  });
});

describe('ordenar lista de espécies', () => {
  it('por Nº Pokédex ou por nome', () => {
    expect(sortSpecies(pichuLine, 'dex').map((s) => s.id)).toEqual(['pikachu', 'raichu', 'pichu']);
    expect(sortSpecies(pichuLine, 'nome').map((s) => s.id)).toEqual(['pichu', 'pikachu', 'raichu']);
  });
});

describe('exemplares: busca e ordenação pelo código de renomear', () => {
  const a = ex({ speciesId: 'raichu', iv: iv(70), shiny: true });
  const b = ex({ speciesId: 'pikachu', iv: iv(95) });
  const col = collection({ exemplars: [a, b] });
  const r = computeCollection(col);

  it('a busca de texto acha pelo código que o exemplar deve receber', () => {
    expect(filterExemplars(col, r, col.exemplars, { text: '0026BR' }).map((e) => e.id)).toEqual([a.id]);
    expect(filterExemplars(col, r, col.exemplars, { text: '25' }).map((e) => e.id)).toEqual([b.id]);
    // número sozinho é Nº Pokédex, não pedaço do código
    expect(filterExemplars(col, r, col.exemplars, { text: '26' }).map((e) => e.id)).toEqual([a.id]);
  });

  it('ordenar e filtrar pelo atributo "código"', () => {
    const sorted = sortExemplars(col, r, col.exemplars, [{ key: 'codigo', dir: 'asc' }]);
    expect(sorted.map((e) => e.id)).toEqual([b.id, a.id]);
    expect(filterExemplars(col, r, col.exemplars, { filters: [{ key: 'codigo', value: '0026BR' }] }).map((e) => e.id)).toEqual([a.id]);
  });
});
