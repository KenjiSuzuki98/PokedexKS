import { IDBFactory } from 'fake-indexeddb';
import { collection, ex, iv } from '../core/test-helpers';
import { createStore } from './store';

let idb: IDBFactory;
beforeEach(() => {
  idb = new IDBFactory();
});

describe('store (IndexedDB)', () => {
  it('banco vazio carrega null', async () => {
    expect(await createStore({ idb }).load()).toBeNull();
  });

  it('salva e carrega a coleção', async () => {
    const store = createStore({ idb });
    const c = collection({ exemplars: [ex({ speciesId: 'pikachu', iv: iv(90) })] });
    await store.save(c);
    expect(await createStore({ idb }).load()).toEqual(c);
  });

  it('salvar de novo substitui', async () => {
    const store = createStore({ idb });
    await store.save(collection());
    const c2 = collection({ exemplars: [ex({ speciesId: 'raichu' })] });
    await store.save(c2);
    expect(await store.load()).toEqual(c2);
  });

  it('loadOrSeed usa a tabela inicial quando não há nada salvo', async () => {
    const store = createStore({ idb });
    const c = await store.loadOrSeed();
    expect(c.species.some((s) => s.id === 'pikachu')).toBe(true);
    expect(c.exemplars).toEqual([]);
  });

  it('dados salvos em esquema antigo são migrados ao carregar', async () => {
    const old = createStore({ idb, schema: { current: 1, migrations: {} } });
    await old.save({ ...collection(), events: undefined } as never);
    const store = createStore({ idb, schema: { current: 2, migrations: { 1: (d) => ({ ...d, events: d.events ?? [] }) } } });
    expect((await store.load())!.events).toEqual([]);
  });

  it('bancos com nomes diferentes não se misturam', async () => {
    await createStore({ idb, name: 'a' }).save(collection({ exemplars: [ex({ speciesId: 'raichu' })] }));
    expect(await createStore({ idb, name: 'b' }).load()).toBeNull();
  });
});
