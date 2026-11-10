import { slugify } from './events';
import type { Collection, Costume, Exemplar, Species } from './types';

export const CURRENT_SCHEMA = 2;

type Data = Record<string, any>;
/** Migração da versão N para N+1. */
export type Migration = (data: Data) => Data;

/** Migrações reais do app. Ao mudar o formato: suba CURRENT_SCHEMA e registre aqui a migração da versão anterior. */
export const MIGRATIONS: Record<number, Migration> = {
  // v2: trajes só dos eventos cadastrados por mim. Sai o que veio da tabela automática (id "<espécie>-<nome>")
  // e não está em uso por nenhum exemplar.
  1: (d) => {
    const species = (d.species ?? []) as Species[];
    const ids = new Set(species.map((s) => s.id));
    const used = new Set(((d.exemplars ?? []) as Exemplar[]).map((e) => e.costumeId).filter(Boolean));
    const automatic = (t: Costume) => {
      if (t.since?.eventId || used.has(t.id)) return false;
      const suffix = '-' + slugify(t.name);
      return t.id.endsWith(suffix) && ids.has(t.id.slice(0, -suffix.length));
    };
    return { ...d, species: species.map((s) => ({ ...s, costumes: (s.costumes ?? []).filter((t) => !automatic(t)) })) };
  },
};

export interface SchemaOptions {
  migrations: Record<number, Migration>;
  current: number;
}

export const DEFAULT_SCHEMA: SchemaOptions = { migrations: MIGRATIONS, current: CURRENT_SCHEMA };

export interface Envelope {
  schemaVersion?: number;
  data?: Data;
}

/** Leva dados salvos em qualquer versão anterior até a versão atual. */
export function migrate(envelope: Envelope, opts: SchemaOptions = DEFAULT_SCHEMA): Collection {
  let version = envelope.schemaVersion;
  if (typeof version !== 'number' || !envelope.data) throw new Error('Arquivo de backup inválido.');
  if (version > opts.current) throw new Error(`Backup de versão mais nova (${version}) que o app (${opts.current}).`);
  let data = envelope.data;
  while (version < opts.current) {
    const step = opts.migrations[version];
    if (!step) throw new Error(`Falta a migração da versão ${version}.`);
    data = step(data);
    version += 1;
  }
  return data as Collection;
}

export function exportBackup(c: Collection): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA, exportedAt: new Date().toISOString(), data: c }, null, 2);
}

export function importBackup(json: string, opts: SchemaOptions = DEFAULT_SCHEMA): Collection {
  return migrate(JSON.parse(json) as Envelope, opts);
}
