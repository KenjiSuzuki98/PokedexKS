import { computeCollection } from './assign';
import { filterExemplars, sortExemplars } from './query';
import { collection, ex, iv } from './test-helpers';

const raichu = ex({ speciesId: 'raichu', iv: iv(70), cp: 2000, date: '2026-03-01', shiny: true });
const pichu = ex({ speciesId: 'pichu', iv: iv(90), cp: 300, date: '2026-01-01' });
const pika1 = ex({ speciesId: 'pikachu', iv: iv(50), cp: 800, date: '2026-02-01', sex: 'femea' });
const pika2 = ex({ speciesId: 'pikachu', iv: iv(95), cp: 900, date: '2026-04-01' });
const c = collection({ exemplars: [raichu, pichu, pika1, pika2] });
const r = computeCollection(c);
const ids = (list: { id: string }[]) => list.map((e) => e.id);

describe('sortExemplars', () => {
  it('por evolução agrupa a cadeia na ordem Pichu, Pikachu, Raichu', () => {
    const sorted = sortExemplars(c, r, c.exemplars, [{ key: 'evolucao', dir: 'asc' }]);
    expect(sorted.map((e) => e.speciesId)).toEqual(['pichu', 'pikachu', 'pikachu', 'raichu']);
    const desc = sortExemplars(c, r, c.exemplars, [{ key: 'evolucao', dir: 'desc' }]);
    expect(desc.map((e) => e.speciesId)).toEqual(['raichu', 'pikachu', 'pikachu', 'pichu']);
  });

  it('dois critérios combinados', () => {
    const sorted = sortExemplars(c, r, c.exemplars, [
      { key: 'evolucao', dir: 'asc' },
      { key: 'iv', dir: 'desc' },
    ]);
    expect(ids(sorted)).toEqual([pichu.id, pika2.id, pika1.id, raichu.id]);
  });

  it('qualquer atributo, crescente e decrescente', () => {
    expect(ids(sortExemplars(c, r, c.exemplars, [{ key: 'cp', dir: 'asc' }]))).toEqual([pichu.id, pika1.id, pika2.id, raichu.id]);
    expect(ids(sortExemplars(c, r, c.exemplars, [{ key: 'data', dir: 'desc' }]))).toEqual([pika2.id, raichu.id, pika1.id, pichu.id]);
    expect(sortExemplars(c, r, c.exemplars, [{ key: 'brilhante', dir: 'desc' }])[0]!.id).toBe(raichu.id);
  });

  it('não altera a lista original', () => {
    const copy = [...c.exemplars];
    sortExemplars(c, r, c.exemplars, [{ key: 'iv', dir: 'asc' }]);
    expect(c.exemplars).toEqual(copy);
  });
});

describe('filterExemplars', () => {
  it('filtra pelos mesmos critérios e por texto', () => {
    expect(ids(filterExemplars(c, r, c.exemplars, { filters: [{ key: 'especie', value: 'pikachu' }] }))).toEqual([pika1.id, pika2.id]);
    expect(ids(filterExemplars(c, r, c.exemplars, { filters: [{ key: 'sexo', value: 'femea' }] }))).toEqual([pika1.id]);
    expect(ids(filterExemplars(c, r, c.exemplars, { filters: [{ key: 'cadeia', value: 'pichu' }] }))).toHaveLength(4);
    expect(ids(filterExemplars(c, r, c.exemplars, { text: 'rai' }))).toEqual([raichu.id]);
    expect(ids(filterExemplars(c, r, c.exemplars, { filters: [{ key: 'brilhante', value: true }] }))).toEqual([raichu.id]);
  });

  it('filtra por status calculado e por faixa de IV', () => {
    const keep = filterExemplars(c, r, c.exemplars, { filters: [{ key: 'status', value: 'manter' }] });
    expect(keep.length).toBe(c.exemplars.filter((e) => r.exemplars[e.id]!.status === 'manter').length);
    expect(ids(filterExemplars(c, r, c.exemplars, { filters: [{ key: 'iv', min: 80 }] }))).toEqual([pichu.id, pika2.id]);
    expect(ids(filterExemplars(c, r, c.exemplars, { filters: [{ key: 'cp', min: 500, max: 1000 }] }))).toEqual([pika1.id, pika2.id]);
  });
});

describe('data de inclusão', () => {
  it('ordena por quando entrou no app (recentes primeiro); sem registro, vale a data do exemplar', () => {
    const velho = ex({ speciesId: 'pikachu', date: '2024-01-01' });
    const novo = ex({ speciesId: 'raichu', date: '2020-01-01', addedAt: '2026-11-10T10:00:00.000Z' });
    const meio = ex({ speciesId: 'pichu', date: '2020-01-01', addedAt: '2026-11-10T09:00:00.000Z' });
    const col = collection({ exemplars: [velho, novo, meio] });
    const res = computeCollection(col);
    const recentes = sortExemplars(col, res, col.exemplars, [{ key: 'inclusao', dir: 'desc' }]);
    expect(recentes.map((e) => e.id)).toEqual([novo.id, meio.id, velho.id]);
  });
});
