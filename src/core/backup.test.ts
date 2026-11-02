import { CURRENT_SCHEMA, exportBackup, importBackup, type Migration } from './backup';
import { collection, ex, iv } from './test-helpers';

describe('backup', () => {
  it('exporta com versão do esquema e importa de volta igual', () => {
    const c = collection({ exemplars: [ex({ speciesId: 'pikachu', iv: iv(90) })] });
    const json = exportBackup(c);
    expect(JSON.parse(json).schemaVersion).toBe(CURRENT_SCHEMA);
    expect(importBackup(json)).toEqual(c);
  });

  it('backup antigo é migrado passo a passo para o esquema novo', () => {
    // v1 hipotética: IV era só um número; v2 passou a ser objeto.
    const migrations: Record<number, Migration> = {
      1: (d) => ({
        ...d,
        exemplars: (d.exemplars as { iv: number }[]).map((e) => ({ ...e, iv: { percent: e.iv } })),
      }),
      2: (d) => ({ ...d, events: d.events ?? [] }),
    };
    const old = JSON.stringify({
      schemaVersion: 1,
      data: { species: [], backgrounds: [], customCategories: [], exemplars: [{ id: 'a', iv: 80 }] },
    });
    const c = importBackup(old, { migrations, current: 3 });
    expect(c.exemplars[0]!.iv).toEqual({ percent: 80 });
    expect(c.events).toEqual([]);
  });

  it('recusa backup de versão mais nova que o app ou sem migração', () => {
    expect(() => importBackup(JSON.stringify({ schemaVersion: CURRENT_SCHEMA + 1, data: {} }))).toThrow(/mais nova/);
    expect(() => importBackup(JSON.stringify({ schemaVersion: 1, data: {} }), { migrations: {}, current: 2 })).toThrow(
      /migração/,
    );
    expect(() => importBackup('não é json')).toThrow();
  });
});
