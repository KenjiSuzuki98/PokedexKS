import type { Collection } from './types';

export const CURRENT_SCHEMA = 1;

type Data = Record<string, any>;
/** Migração da versão N para N+1. */
export type Migration = (data: Data) => Data;

/** Migrações reais do app. Ao mudar o formato: suba CURRENT_SCHEMA e registre aqui a migração da versão anterior. */
export const MIGRATIONS: Record<number, Migration> = {};

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
