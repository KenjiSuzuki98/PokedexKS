import { computeCollection } from './assign';
import { listChains, type ChainQuery } from './chains';
import { computeProgress } from './progress';
import { collection, ex, iv, pichuLine, species } from './test-helpers';

const mag = species({ id: 'magnemite', name: 'Magnemite', dex: 81, gender: 'sem' });
const tread = species({ id: 'treecko', name: 'Treecko', dex: 252 });
const c = collection({
  species: [...pichuLine, mag, tread],
  exemplars: [
    ex({ speciesId: 'raichu', iv: iv(90), addedAt: '2026-01-01T00:00:00Z' }),
    ex({ speciesId: 'magnemite', iv: iv(50), addedAt: '2026-11-01T00:00:00Z' }),
  ],
});
const r = computeCollection(c);
const p = computeProgress(c, r);
const ids = (q: Partial<ChainQuery>) => listChains(c, r, p, { sort: { key: 'dex', dir: 'asc' }, filter: 'todas', ...q }).map((x) => x.rootId);

describe('listChains (cadeias da Coleção)', () => {
  it('ordena por Nº, nome, progresso e inclusão', () => {
    expect(ids({})).toEqual(['magnemite', 'pichu', 'treecko']);
    expect(ids({ sort: { key: 'nome', dir: 'desc' } })).toEqual(['treecko', 'pichu', 'magnemite']);
    expect(ids({ sort: { key: 'progresso', dir: 'desc' } })[2]).toBe('treecko');
    expect(ids({ sort: { key: 'inclusao', dir: 'desc' } })).toEqual(['magnemite', 'pichu', 'treecko']);
    expect(ids({ sort: { key: 'inclusao', dir: 'asc' } })).toEqual(['pichu', 'magnemite', 'treecko']);
  });

  it('filtra por situação: iniciadas, vazias, com reservas', () => {
    expect(ids({ filter: 'iniciadas' })).toEqual(['magnemite', 'pichu']);
    expect(ids({ filter: 'vazias' })).toEqual(['treecko']);
    expect(ids({ filter: 'completas' })).toEqual([]);
    expect(ids({ filter: 'incompletas' })).toEqual(['magnemite', 'pichu', 'treecko']);
    const withReserve = collection({ exemplars: [ex({ speciesId: 'pikachu', iv: iv(80) })] });
    const r2 = computeCollection(withReserve);
    const rows = listChains(withReserve, r2, computeProgress(withReserve, r2), { sort: { key: 'dex', dir: 'asc' }, filter: 'com-reservas' });
    expect(rows.map((x) => x.rootId)).toEqual(['pichu']);
  });

  it('filtra por região e por texto (nome, Nº ou código)', () => {
    expect(ids({ region: 'Hoenn' })).toEqual(['treecko']);
    expect(ids({ text: '0026BR' })).toEqual(['pichu']);
  });
});
