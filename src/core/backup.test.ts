import { CURRENT_SCHEMA, exportBackup, importBackup, type Migration } from './backup';
import { collection, ex, iv, species } from './test-helpers';
import seed from '../data/species.json';

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

  it('v1 → v2: tira os trajes automáticos da tabela, menos os que algum exemplar usa', () => {
    const pikachu = species({
      id: 'pikachu',
      name: 'Pikachu',
      dex: 25,
      costumes: [
        { id: 'pikachu-festa', code: 'FEST', name: 'Festa', shiny: true },
        { id: 'pikachu-boina', code: 'BOIN', name: 'Boina', shiny: false },
        { id: 'libre', code: 'LIBR', name: 'Libre', shiny: false },
        { id: 'pikachu-halloween', code: 'HALL', name: 'Halloween', shiny: false, since: { eventId: 'ev1' } },
      ],
    });
    const raichu = species({
      id: 'raichu', name: 'Raichu', dex: 26, evolvesFrom: 'pikachu',
      costumes: [{ id: 'pikachu-festa', code: 'FEST', name: 'Festa', shiny: true }],
    });
    const old = JSON.stringify({
      schemaVersion: 1,
      data: collection({ species: [pikachu, raichu], exemplars: [ex({ speciesId: 'pikachu', costumeId: 'pikachu-boina' })] }),
    });
    const c = importBackup(old);
    expect(c.species[0]!.costumes.map((t) => t.id)).toEqual(['pikachu-boina', 'libre', 'pikachu-halloween']);
    expect(c.species[1]!.costumes).toEqual([]);
  });

  it('a tabela inicial de espécies não traz trajes automáticos', () => {
    expect((seed as { costumes: unknown[] }[]).every((s) => s.costumes.length === 0)).toBe(true);
  });
});
