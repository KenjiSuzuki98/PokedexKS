import { DEFAULT_SCHEMA, migrate, type Envelope, type SchemaOptions } from '../core/backup';
import type { Collection, Species } from '../core/types';
import seed from '../data/species.json';

const STORE = 'colecao';
const KEY = 'atual';

export interface StoreOptions {
  idb?: IDBFactory;
  name?: string;
  schema?: SchemaOptions;
}

export interface Store {
  load(): Promise<Collection | null>;
  /** Carrega o que está salvo ou começa com a tabela inicial de espécies. */
  loadOrSeed(): Promise<Collection>;
  save(c: Collection): Promise<void>;
}

const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

/** A coleção inteira fica num único registro, no mesmo envelope versionado do backup. */
export function createStore(opts: StoreOptions = {}): Store {
  const idb = opts.idb ?? indexedDB;
  const schema = opts.schema ?? DEFAULT_SCHEMA;

  function open(): Promise<IDBDatabase> {
    const r = idb.open(opts.name ?? 'pokedex-ks', 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    return request(r);
  }

  async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    try {
      return await request(fn(db.transaction(STORE, mode).objectStore(STORE)));
    } finally {
      db.close();
    }
  }

  const store: Store = {
    async load() {
      const envelope = (await withStore('readonly', (s) => s.get(KEY))) as Envelope | undefined;
      return envelope ? migrate(envelope, schema) : null;
    },
    async loadOrSeed() {
      return (
        (await store.load()) ?? {
          species: structuredClone(seed) as Species[],
          backgrounds: [],
          customCategories: [],
          events: [],
          exemplars: [],
        }
      );
    },
    async save(c) {
      await withStore('readwrite', (s) => s.put({ schemaVersion: schema.current, data: c }, KEY));
    },
  };
  return store;
}
